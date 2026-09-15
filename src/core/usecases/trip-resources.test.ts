import { describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";
import { ForbiddenError, NotFoundError, RevisionConflictError, UnauthorizedError } from "../domain/errors.ts";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../domain/ids.ts";
import { ResourceExtractionError, ResourceSourceSchema, type TripResource } from "../domain/trip-resource.ts";
import type { TripRoom } from "../domain/room.ts";
import { SessionService } from "../ports/session.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { TripResourceRepository } from "../ports/trip-resource-repository.ts";
import { TripResourceExtractor } from "../ports/trip-resource-extractor.ts";
import { createTripResource, deleteTripResource, editTripResourcePlace, listTripResources, organizeTripResource } from "./trip-resources.ts";

const tripId = TripIdSchema.make("trip-resource-test");
const author = ParticipantIdSchema.make("author");
const member = ParticipantIdSchema.make("member");
const host = ParticipantIdSchema.make("host");
const room: TripRoom = { id: tripId, title: "여행", destination: "제주", revision: RevisionSchema.make(1), plans: [], members: [
  { id: author, name: "작성자", role: "MEMBER" }, { id: member, name: "멤버", role: "MEMBER" }, { id: host, name: "방장", role: "HOST" },
] };
const source: TripResource = {
  id: "8f6c2e21-bbe3-455a-a323-8eb2c4a4ae91", tripId, createdBy: author, createdByName: "작성자",
  createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z", revision: RevisionSchema.make(1),
  url: "", note: "성산일출봉에서 일출을 보고 싶다.", places: null, processedAt: null, linkStatus: "NOT_READ",
};
const place = { name: "성산일출봉", category: "SIGHT" as const, location: "", summary: "일출을 보고 싶다는 멤버 의견", evidence: { source: "NOTE" as const, text: source.note } };
const unreachable = () => Effect.die("Unexpected repository operation");

function harness(actor: typeof author | null = member, initial = source) {
  let current = initial;
  const session = { participantId: actor ?? member, participantIds: [actor ?? member], accountType: "REGISTERED" as const, name: "현재 멤버", isAuthenticated: true };
  const getSession = () => actor ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ reason: "로그인 필요" }));
  const getRoom = vi.fn<typeof TripRoomRepository.Service.getRoom>(() => Effect.succeed(room));
  const repo = {
    get: vi.fn<typeof TripResourceRepository.Service.get>((requestedTrip) => requestedTrip === tripId ? Effect.succeed(current) : Effect.fail(new NotFoundError({ entity: "TripResource", id: current.id }))),
    list: vi.fn<typeof TripResourceRepository.Service.list>(() => Effect.succeed([current])),
    create: vi.fn<typeof TripResourceRepository.Service.create>((input) => Effect.succeed({ ...source, ...input })),
    saveResult: vi.fn<typeof TripResourceRepository.Service.saveResult>((_trip, _id, expectedRevision, result) => {
      if (current.revision !== expectedRevision) return Effect.fail(new RevisionConflictError({ message: "stale", expectedRevision, actualRevision: current.revision }));
      current = { ...current, ...result, revision: RevisionSchema.make(current.revision + 1) };
      return Effect.succeed(current);
    }),
    remove: vi.fn<typeof TripResourceRepository.Service.remove>(() => Effect.void),
  } satisfies typeof TripResourceRepository.Service;
  const extractor = { available: true, extract: vi.fn<typeof TripResourceExtractor.Service.extract>(() => Effect.succeed({ places: [place], linkStatus: "NOT_READ" as const })) };
  const roomRepo: typeof TripRoomRepository.Service = {
    getRoom, getRooms: unreachable, getRoomOverviewRecords: unreachable, createRoom: unreachable,
    updateRoom: unreachable, createPlan: unreachable, updatePlan: unreachable, saveRoom: unreachable,
    saveRoomWithActivity: unreachable, deletePlanAndAutoUnlist: unreachable,
  };
  const run = <A, E>(program: Effect.Effect<A, E, SessionService | TripRoomRepository | TripResourceRepository | TripResourceExtractor>) => Effect.runPromise(program.pipe(
    Effect.provideService(SessionService, { getCurrentUser: getSession, getCurrentSession: getSession }),
    Effect.provideService(TripRoomRepository, roomRepo),
    Effect.provideService(TripResourceRepository, repo),
    Effect.provideService(TripResourceExtractor, extractor),
  ));
  return { run, repo, extractor, getRoom, setCurrent: (value: TripResource) => { current = value; } };
}

describe("shared trip resources", () => {
  it("denies unauthenticated users and conceals private trips from outsiders before resource I/O", async () => {
    for (const actor of [null, ParticipantIdSchema.make("outsider")]) {
      const h = harness(actor);
      await expect(h.run(listTripResources(tripId))).rejects.toBeInstanceOf(actor === null ? UnauthorizedError : NotFoundError);
      expect(h.repo.list).not.toHaveBeenCalled();
    }
  });
  it("creates using server session identity and preserves a note-only source", async () => {
    const h = harness();
    const result = await h.run(createTripResource(tripId, { url: "", note: "  성산일출봉  " }));
    expect(result).toMatchObject({ createdBy: member, createdByName: "현재 멤버", note: "성산일출봉", places: null });
    expect(h.extractor.extract).not.toHaveBeenCalled();
  });
  it("lets members organize sources and preserves original input and evidence", async () => {
    const h = harness();
    const result = await h.run(organizeTripResource(tripId, source.id, source.revision));
    expect(result).toMatchObject({ note: source.note, places: [{ ...place, edited: false }], revision: 2, canManage: false });
  });
  it("never calls the provider for a stale request", async () => {
    const h = harness();
    await expect(h.run(organizeTripResource(tripId, source.id, RevisionSchema.make(2)))).rejects.toBeInstanceOf(RevisionConflictError);
    expect(h.extractor.extract).not.toHaveBeenCalled();
  });
  it("does not regenerate completed or manually corrected cards", async () => {
    const h = harness(member, { ...source, places: [{ ...place, edited: true }], processedAt: source.createdAt });
    const result = await h.run(organizeTripResource(tripId, source.id, source.revision));
    expect(result.places?.[0].edited).toBe(true);
    expect(h.extractor.extract).not.toHaveBeenCalled();
    expect(h.repo.saveResult).not.toHaveBeenCalled();
  });
  it("preserves the source on extraction failure", async () => {
    const h = harness();
    h.extractor.extract.mockReturnValue(Effect.fail(new ResourceExtractionError({ reason: "SOURCE_UNREADABLE" })));
    await expect(h.run(organizeTripResource(tripId, source.id, source.revision))).rejects.toBeInstanceOf(ResourceExtractionError);
    expect(h.repo.saveResult).not.toHaveBeenCalled();
  });
  it("rechecks membership after provider work before storing", async () => {
    const h = harness();
    h.getRoom.mockReturnValueOnce(Effect.succeed(room)).mockReturnValue(Effect.succeed({ ...room, members: [] }));
    await expect(h.run(organizeTripResource(tripId, source.id, source.revision))).rejects.toBeInstanceOf(NotFoundError);
    expect(h.repo.saveResult).not.toHaveBeenCalled();
  });
  it("does not overwrite a concurrent change during extraction", async () => {
    const h = harness();
    h.extractor.extract.mockImplementation(() => Effect.sync(() => {
      h.setCurrent({ ...source, revision: RevisionSchema.make(2) });
      return { places: [place], linkStatus: "NOT_READ" as const };
    }));
    await expect(h.run(organizeTripResource(tripId, source.id, source.revision))).rejects.toBeInstanceOf(RevisionConflictError);
  });
  it("edits a single card while preserving evidence and sibling cards", async () => {
    const h = harness(member, { ...source, places: [{ ...place, edited: false }, { ...place, name: "다른 장소", edited: false }], processedAt: source.createdAt });
    const result = await h.run(editTripResourcePlace(tripId, source.id, {
      expectedRevision: source.revision, index: 0, name: "수정한 장소", category: "OTHER", location: "수정 위치", summary: "수정 내용",
    }));
    expect(result.places?.[0]).toMatchObject({ name: "수정한 장소", edited: true, evidence: place.evidence });
    expect(result.places?.[1].name).toBe("다른 장소");
  });
  it("only the author or host can delete", async () => {
    const h = harness();
    await expect(h.run(deleteTripResource(tripId, source.id, source.revision))).rejects.toBeInstanceOf(ForbiddenError);
    expect(h.repo.remove).not.toHaveBeenCalled();
    for (const actor of [author, host]) {
      const allowed = harness(actor);
      expect(await allowed.run(deleteTripResource(tripId, source.id, source.revision))).toEqual({ deleted: true });
    }
  });
  it("rejects blank sources, executable URLs, credentials and oversized notes", () => {
    const valid = Schema.is(ResourceSourceSchema);
    expect(valid({ url: "", note: "메모" })).toBe(true);
    for (const input of [
      { url: "", note: "  " }, { url: "javascript:alert(1)", note: "" },
      { url: "https://user:password@example.com", note: "" }, { url: "", note: "a".repeat(20_001) },
    ]) expect(valid(input)).toBe(false);
  });
});
