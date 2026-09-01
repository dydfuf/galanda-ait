import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { RepositoryError } from "../../../core/domain/errors.ts";
import {
  ExploreListingIdSchema,
  ParticipantIdSchema,
} from "../../../core/domain/ids.ts";
import { ExploreSaveRepository } from "../../../core/ports/explore-save-repository.ts";
import { Database } from "./database.ts";
import { ExploreSaveRepositoryLive } from "./explore-save-repository.ts";
import * as schema from "./schema/index.ts";

const listingId = ExploreListingIdSchema.make("listing-1");
const participant = ParticipantIdSchema.make("participant-canonical");
const aliasParticipant = ParticipantIdSchema.make("participant-alias");

const listingColumns = (over?: {
  readonly status?: string;
  readonly listedAt?: string;
}) => {
  const listedAt = over?.listedAt ?? "2026-09-01T00:00:00.000Z";
  return {
    savedAt: new Date("2026-09-02T00:00:00.000Z"),
    id: "listing-1",
    status: over?.status ?? "LISTED",
    listingRevision: 1,
    sourcePlanRevision: 1,
    snapshot: {
      title: "교토 3박 4일",
      destination: "일본 간사이",
      routes: [
        { city: "교토", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
      ],
      dateRange: { startDate: "2026-10-01", endDate: "2026-10-04", nightCount: 3 },
      stays: [],
      transports: [],
      author: { displayName: "여행자" },
      sourcePlanRevision: 1,
    },
    listedAt: new Date(listedAt),
    updatedAt: new Date(listedAt),
    unlistedAt: null,
    saveCount: 0,
  };
};

const makeDb = (
  handler: (
    config: { readonly text: string },
    params: unknown[]
  ) => { readonly rows: unknown[] },
  calls?: Array<{ readonly text: string; readonly params: unknown[] }>
) => {
  const client = {
    query: async (config: { readonly text: string }, params: unknown[] = []) => {
      calls?.push({ text: config.text, params });
      return handler(config, params);
    },
  };
  return drizzle(client as unknown as NodePgClient, { schema });
};

const provide = <A, E>(
  db: ReturnType<typeof makeDb>,
  effect: Effect.Effect<A, E, ExploreSaveRepository>
) =>
  effect.pipe(
    Effect.provide(
      ExploreSaveRepositoryLive.pipe(
        Layer.provide(Layer.succeed(Database, { db }))
      )
    )
  );

describe("ExploreSaveRepositoryLive", () => {
  it("save는 이미 저장돼 있으면 insert 없이 idempotent하게 성공한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    // listing lock + active-save probe + aggregate count.
    const db = makeDb((config) => {
      if (config.text.includes('from "explore_plan_listings"')) {
        return { rows: [["LISTED"]] };
      }
      if (config.text.includes('select "listing_id"')) {
        return { rows: [["existing"]] };
      }
      if (config.text.includes("count(distinct")) return { rows: [[0]] };
      return { rows: [] };
    }, calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.save({
            participantId: participant,
            participantIds: [participant, aliasParticipant],
            listingId,
            savedAt: "2026-09-02T00:00:00.000Z",
          });
        })
      )
    );

    expect(result).toEqual({ saved: true, saveCount: 0 });
    // insert가 발생하지 않았다.
    expect(calls.some((c) => c.text.startsWith("insert"))).toBe(false);
  });

  it("save는 미저장 시 canonical participant로 ON CONFLICT DO NOTHING insert한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.includes('from "explore_plan_listings"')) {
        return { rows: [["LISTED"]] };
      }
      if (config.text.includes("count(distinct")) return { rows: [[0]] };
      return { rows: [] };
    }, calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.save({
            participantId: participant,
            participantIds: [participant, aliasParticipant],
            listingId,
            savedAt: "2026-09-02T00:00:00.000Z",
          });
        })
      )
    );

    expect(result).toEqual({ saved: true, saveCount: 0 });
    const insert = calls.find((c) => c.text.startsWith("insert"));
    expect(insert).toBeDefined();
    expect(insert!.text).toContain("on conflict");
    expect(insert!.text).toContain("do nothing");
    // canonical participant로만 insert(alias 아님).
    expect(insert!.params).toContain("participant-canonical");
    expect(insert!.params).not.toContain("participant-alias");
    // surrogate id를 더 이상 넘기지 않는다(관계 자체가 identity).
    expect(insert!.params).not.toContain("save-1");
  });

  it("unsave는 alias 집합 전체에서 삭제하며 대상이 없어도 성공한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb(() => ({ rows: [] }), calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.unsave({
            participantIds: [participant, aliasParticipant],
            listingId,
            unsavedAt: "2026-09-03T00:00:00.000Z",
          });
        })
      )
    );

    expect(result).toEqual({ saved: false, saveCount: 0 });
    const del = calls.find((c) => c.text.startsWith("update"));
    expect(del).toBeDefined();
    // alias 집합 모두가 삭제 조건에 포함된다.
    expect(del!.params).toContain("participant-canonical");
    expect(del!.params).toContain("participant-alias");
  });

  it("isSaved는 alias 집합 중 하나라도 저장했으면 true다", async () => {
    const db = makeDb((config) =>
      config.text.startsWith("select") ? { rows: [["x"]] } : { rows: [] }
    );

    const saved = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.isSaved({
            participantIds: [participant, aliasParticipant],
            listingId,
          });
        })
      )
    );

    expect(saved).toEqual({ saved: true, saveCount: 0 });
  });

  it("listSaved는 LISTED listing만 join하고 keyset paginate한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const cols = listingColumns();
    // limit+1 요청 대비 2개 반환(limit=1 → hasMore).
    const db = makeDb(() => ({ rows: [Object.values(cols), Object.values(cols)] }), calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.listSaved({
            participantIds: [participant],
            limit: 1,
          });
        })
      )
    );

    expect(result.page).toHaveLength(1);
    expect(result.page[0]!.listing.status).toBe("LISTED");
    expect(result.page[0]!.savedAt).toBe("2026-09-02T00:00:00.000Z");
    expect(result.nextCursor).toBeDefined();
    // read-through join + LISTED filter.
    const select = calls.find((c) => c.text.includes("inner join"))!;
    expect(select.text).toContain("explore_plan_listings");
    expect(select.params).toContain("LISTED");
    // alias dedupe: listing_id로 grouping하고 MIN(saved_at)을 대표값으로 쓴다.
    expect(select.text).toContain("group by");
    expect(select.text).toContain("min(");
    // 외부 pagination(order/limit)은 deduped subquery 위에서 일어난다.
    expect(select.text).toContain("order by");
    // keyset order와 index column 순서가 (participant_id, saved_at DESC, listing_id DESC)로 일치.
    expect(select.text).not.toContain('"id" desc');
  });

  it("listSaved는 canonical+alias가 같은 listing을 저장해도 논리적 항목을 하나로 dedupe한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    // canonical과 alias가 각각 같은 listing-1을 저장한 상황을 시뮬레이션한다.
    // DB의 GROUP BY listing_id + MIN(saved_at)이 이를 한 row로 collapse하므로
    // 드라이버는 이미 dedupe된 단일 row를 돌려준다(SQL-level 방어).
    const canonicalSave = listingColumns(); // saved_at = 2026-09-02 (더 이른 원래 시각)
    const db = makeDb(() => ({ rows: [Object.values(canonicalSave)] }), calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.listSaved({
            participantIds: [participant, aliasParticipant],
            limit: 10,
          });
        })
      )
    );

    // 같은 listing이 canonical+alias 양쪽에 있어도 카드는 하나만 노출된다.
    expect(result.page).toHaveLength(1);
    expect(result.page[0]!.listing.listingId).toBe("listing-1");
    // 대표 savedAt은 가장 오래된(원래) 저장 시각(MIN)이다.
    expect(result.page[0]!.savedAt).toBe("2026-09-02T00:00:00.000Z");
    // 페이지가 limit 미만이면 false nextCursor가 생기지 않는다(중복 page 방지).
    expect(result.nextCursor).toBeUndefined();

    // 두 alias participant 모두가 dedupe 대상 필터에 포함된다.
    const select = calls.find((c) => c.text.includes("group by"))!;
    expect(select).toBeDefined();
    expect(select.params).toContain("participant-canonical");
    expect(select.params).toContain("participant-alias");
  });

  it("listSaved의 keyset cursor는 deduped tuple에 대해 동작한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const cols = listingColumns();
    const db = makeDb(() => ({ rows: [Object.values(cols)] }), calls);

    await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repo = yield* ExploreSaveRepository;
          return yield* repo.listSaved({
            participantIds: [participant, aliasParticipant],
            limit: 10,
            cursor: {
              savedAt: "2026-09-05T00:00:00.000Z",
              listingId: listingId,
            },
          });
        })
      )
    );

    // keyset predicate는 deduped subquery의 saved_at/listing_id 위에서 평가된다.
    const select = calls.find((c) => c.text.includes("group by"))!;
    expect(select.text).toContain("deduped_saves");
    // cursor tuple이 파라미터로 전달된다.
    expect(select.params).toContain("listing-1");
  });

  it("listSaved의 malformed snapshot은 fallback 없이 RepositoryError로 실패한다", async () => {
    const cols = { ...listingColumns(), snapshot: { title: "broken" } };
    const db = makeDb(() => ({ rows: [Object.values(cols)] }));

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repo = yield* ExploreSaveRepository;
            return yield* repo.listSaved({
              participantIds: [participant],
              limit: 10,
            });
          })
        )
      )
    );

    expect(error).toBeInstanceOf(RepositoryError);
  });
});
