import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../../../core/domain/ids.ts";
import type { ResourceResult } from "../../../core/ports/trip-resource-repository.ts";
import { makeDrizzleTripResourceRepository } from "./trip-resource-repository.ts";
import * as schema from "./schema/index.ts";

const tripId = TripIdSchema.make("trip-1");
const id = "ed8bab53-ff72-401b-ae38-491be7690547";
const revision = RevisionSchema.make(1);
const now = "2026-09-16T00:00:00.000Z";
const result: ResourceResult = { places: [], processedAt: now, linkStatus: "READ" };
const createInput = { tripId, createdBy: ParticipantIdSchema.make("member-1"), createdByName: "멤버", url: "", note: "경복궁에 가자" };

const row = (currentRevision = 1, places: unknown = null) => [
  id, tripId, "member-1", "멤버", now, now, currentRevision, "", "경복궁에 가자", places, null, "NOT_READ",
];

const makeDb = (responses: ReadonlyArray<unknown[][] | Error>) => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  let index = 0;
  const client = {
    query: async (config: string | { text: string }, params: unknown[] = []) => {
      const text = typeof config === "string" ? config : config.text;
      calls.push({ text, params });
      if (["begin", "commit", "rollback"].includes(text)) return { rows: [] };
      const response = responses[index++] ?? [];
      if (response instanceof Error) throw response;
      return { rows: response };
    },
  };
  const db = drizzle(client as unknown as NodePgClient, { schema });
  return { repository: makeDrizzleTripResourceRepository(db), calls };
};

describe("DrizzleTripResourceRepository", () => {
  it("여행별 자료를 최대 200개까지 최신순으로 조회하고 미정리 null을 보존한다", async () => {
    const { repository, calls } = makeDb([[row()]]);
    const resources = await Effect.runPromise(repository.list(tripId));
    expect(resources[0]).toMatchObject({ id, tripId, places: null, revision: 1 });
    expect(calls[0].text).toContain('where "trip_resources"."trip_id" = $1');
    expect(calls[0].text).toContain('order by "trip_resources"."created_at" desc, "trip_resources"."id" desc');
    expect(calls[0].params).toEqual([tripId, 200]);
  });

  it("단건 조회도 tripId와 id를 함께 제한하며 다른 여행 자료는 NotFound다", async () => {
    const { repository, calls } = makeDb([[]]);
    const error = await Effect.runPromise(Effect.flip(repository.get(tripId, id)));
    expect(error._tag).toBe("NotFoundError");
    expect(calls[0].text).toContain('("trip_resources"."trip_id" = $1 and "trip_resources"."id" = $2)');
    expect(calls[0].params).toEqual([tripId, id, 1]);
  });

  it("생성은 부모 여행 row 잠금 이후 count와 INSERT를 한 transaction에서 실행한다", async () => {
    const { repository, calls } = makeDb([[[tripId]], [[199]], [row()]]);
    expect((await Effect.runPromise(repository.create(createInput))).id).toBe(id);
    expect(calls.map((call) => call.text.split(" ")[0])).toEqual(["begin", "select", "select", "insert", "commit"]);
    expect(calls[1].text).toContain("for update");
    expect(calls[1].params).toEqual([tripId, 1]);
    expect(calls[2].text).toContain('count(*) from "trip_resources" where "trip_resources"."trip_id" = $1');
    expect(calls[2].params).toEqual([tripId]);
    expect(calls[3].params).toEqual([tripId, createInput.createdBy, createInput.createdByName, "", createInput.note]);
  });

  it.each([200, 201])("자료 %i개인 여행에는 INSERT 없이 한도 오류를 반환한다", async (total) => {
    const { repository, calls } = makeDb([[[tripId]], [[total]]]);
    const error = await Effect.runPromise(Effect.flip(repository.create(createInput)));
    expect(error._tag).toBe("ValidationError");
    expect(calls.some((call) => call.text.startsWith("insert"))).toBe(false);
  });

  it("존재하지 않는 여행에는 count나 INSERT를 실행하지 않는다", async () => {
    const { repository, calls } = makeDb([[]]);
    const error = await Effect.runPromise(Effect.flip(repository.create(createInput)));
    expect(error).toMatchObject({ _tag: "NotFoundError", entity: "TripRoom" });
    expect(calls).toHaveLength(3);
  });

  it("정리 결과는 tripId + id + revision CAS로만 저장하며 revision을 증가시킨다", async () => {
    const { repository, calls } = makeDb([[row(2, [])]]);
    expect((await Effect.runPromise(repository.saveResult(tripId, id, revision, result))).revision).toBe(2);
    expect(calls[0].text).toContain('"revision" = "trip_resources"."revision" + 1');
    expect(calls[0].text).toContain('where (("trip_resources"."trip_id" = $4 and "trip_resources"."id" = $5) and "trip_resources"."revision" = $6)');
    expect(calls[0].params.slice(-3)).toEqual([tripId, id, revision]);
  });

  it("삭제도 tripId + id + revision CAS로 제한한다", async () => {
    const { repository, calls } = makeDb([[[id]]]);
    await Effect.runPromise(repository.remove(tripId, id, revision));
    expect(calls[0].text).toContain('delete from "trip_resources" where (("trip_resources"."trip_id" = $1 and "trip_resources"."id" = $2) and "trip_resources"."revision" = $3)');
    expect(calls[0].params).toEqual([tripId, id, revision]);
  });

  it.each(["saveResult", "remove"] as const)("%s CAS 실패는 삭제와 revision 충돌을 구분한다", async (operation) => {
    for (const exists of [true, false]) {
      const { repository, calls } = makeDb([[], exists ? [row(3)] : []]);
      const effect = operation === "saveResult"
        ? repository.saveResult(tripId, id, revision, result)
        : repository.remove(tripId, id, revision);
      const error = await Effect.runPromise(Effect.flip(effect));
      expect(error).toMatchObject(exists
        ? { _tag: "RevisionConflictError", expectedRevision: 1, actualRevision: 3 }
        : { _tag: "NotFoundError" });
      expect(calls[1].params).toEqual([tripId, id, 1]);
    }
  });

  it("DB 장애와 잘못된 places는 RepositoryError로 반환한다", async () => {
    for (const response of [new Error("database down"), [row(1, [{ name: "검증 안 된 데이터" }])]]) {
      const { repository } = makeDb([response]);
      const error = await Effect.runPromise(Effect.flip(repository.list(tripId)));
      expect(error._tag).toBe("RepositoryError");
    }
  });
});
