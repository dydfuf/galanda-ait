import { Clock, Effect } from "effect";
import { getRoomActor } from "../domain/auth-guards.ts";
import { ForbiddenError, NotFoundError, RevisionConflictError, ValidationError } from "../domain/errors.ts";
import type { Revision, TripId } from "../domain/ids.ts";
import type { PlaceCard, ResourceSource, TripResource } from "../domain/trip-resource.ts";
import { TripResourceExtractor } from "../ports/trip-resource-extractor.ts";
import { TripResourceRepository } from "../ports/trip-resource-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { getTripRoom } from "./get-room.ts";

const resourceAccess = Effect.fn("resourceAccess")(function* (tripId: TripId) {
  const room = yield* getTripRoom(tripId);
  const session = yield* requireAuthSession();
  const repository = yield* TripResourceRepository;
  const canManage = (resource: TripResource) =>
    session.participantIds.includes(resource.createdBy) || getRoomActor(room, session.participantIds).isHost;
  const present = (resource: TripResource) => ({ ...resource, canManage: canManage(resource) });
  return { session, repository, canManage, present };
});

const requireRevision = (resource: TripResource, expectedRevision: Revision) =>
  resource.revision === expectedRevision ? Effect.void : Effect.fail(new RevisionConflictError({
    message: "다른 멤버가 자료를 변경했어요. 최신 내용을 확인해주세요.",
    expectedRevision,
    actualRevision: resource.revision,
  }));

export const listTripResources = Effect.fn("listTripResources")(function* (tripId: TripId) {
  const { repository, present } = yield* resourceAccess(tripId);
  const extractor = yield* TripResourceExtractor;
  return { items: (yield* repository.list(tripId)).map(present), extractionAvailable: extractor.available };
});

export const createTripResource = Effect.fn("createTripResource")(
  function* (tripId: TripId, source: ResourceSource) {
    const { repository, session, present } = yield* resourceAccess(tripId);
    const url = source.url.trim();
    const note = source.note.trim();
    if (!url && !note) return yield* Effect.fail(new ValidationError({ message: "링크나 메모를 입력해주세요." }));
    return present(yield* repository.create({ tripId, url, note,
      createdBy: session.participantId, createdByName: session.name }));
  },
);

export const organizeTripResource = Effect.fn("organizeTripResource")(
  function* (tripId: TripId, id: string, expectedRevision: Revision) {
    const { repository } = yield* resourceAccess(tripId);
    const source = yield* repository.get(tripId, id);
    yield* requireRevision(source, expectedRevision);
    // A repeated request must not regenerate or overwrite corrected cards.
    if (source.places !== null) {
      const { present } = yield* resourceAccess(tripId);
      return present(source);
    }
    const extractor = yield* TripResourceExtractor;
    const result = yield* extractor.extract({ url: source.url, note: source.note });
    const processedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
    // Membership and revision may change while the external request is running.
    const { present } = yield* resourceAccess(tripId);
    return present(yield* repository.saveResult(tripId, id, expectedRevision, {
      ...result,
      places: result.places.map((place) => ({ ...place, edited: false })),
      processedAt,
    }));
  },
);

export const editTripResourcePlace = Effect.fn("editTripResourcePlace")(
  function* (tripId: TripId, id: string, input: {
    readonly expectedRevision: Revision;
    readonly index: number;
    readonly name: string;
    readonly category: PlaceCard["category"];
    readonly location: string;
    readonly summary: string;
  }) {
    const { repository, present } = yield* resourceAccess(tripId);
    const resource = yield* repository.get(tripId, id);
    yield* requireRevision(resource, input.expectedRevision);
    const original = resource.places?.[input.index];
    if (!original || !resource.processedAt) {
      return yield* Effect.fail(new NotFoundError({ entity: "PlaceCard", id }));
    }
    const places = resource.places!.map((place, index) => index === input.index ? {
      ...place, name: input.name.trim(), category: input.category,
      location: input.location.trim(), summary: input.summary.trim(), edited: true,
    } : place);
    return present(yield* repository.saveResult(tripId, id, input.expectedRevision, {
      places, processedAt: resource.processedAt, linkStatus: resource.linkStatus,
    }));
  },
);

export const deleteTripResource = Effect.fn("deleteTripResource")(
  function* (tripId: TripId, id: string, expectedRevision: Revision) {
    const { repository, canManage } = yield* resourceAccess(tripId);
    const resource = yield* repository.get(tripId, id);
    if (!canManage(resource)) {
      return yield* Effect.fail(new ForbiddenError({ reason: "자료를 올린 멤버나 방장만 삭제할 수 있어요." }));
    }
    yield* repository.remove(tripId, id, expectedRevision);
    return { deleted: true as const };
  },
);
