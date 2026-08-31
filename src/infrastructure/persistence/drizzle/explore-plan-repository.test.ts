import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
  StateConflictError,
} from "../../../core/domain/errors.ts";
import type { ExplorePlanListing } from "../../../core/domain/explore-plan.ts";
import {
  ExploreListingIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../../core/domain/ids.ts";
import {
  ExplorePlanRepository,
  type ExplorePlanListingRecord,
} from "../../../core/ports/explore-plan-repository.ts";
import { Database } from "./database.ts";
import { ExplorePlanRepositoryLive } from "./explore-plan-repository.ts";
import * as schema from "./schema/index.ts";

const snapshot = (sourcePlanRevision = 1) => ({
  title: "교토 3박 4일",
  destination: "일본 간사이",
  routes: [
    {
      city: "교토",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-04",
    },
  ],
  dateRange: {
    startDate: "2026-10-01",
    endDate: "2026-10-04",
    nightCount: 3,
  },
  stays: [{ city: "교토", hotelName: "호텔 A", isSearching: false, nights: 3 }],
  transports: [],
  author: { displayName: "여행자" },
  sourcePlanRevision: RevisionSchema.make(sourcePlanRevision),
});

/** DB row array in schema column order (see explore-plan.ts). */
const row = (overrides?: {
  readonly id?: string;
  readonly status?: string;
  readonly listingRevision?: number;
  readonly sourcePlanRevision?: number;
  readonly snapshot?: unknown;
  readonly listedAt?: string;
  readonly unlistedAt?: string | null;
}) => {
  const id = overrides?.id ?? "listing-1";
  const listedAt = overrides?.listedAt ?? "2026-09-01T00:00:00.000Z";
  return [
    id,
    "trip-1",
    "plan-1",
    "author-1",
    overrides?.snapshot ?? snapshot(overrides?.sourcePlanRevision ?? 1),
    overrides?.status ?? "LISTED",
    overrides?.listingRevision ?? 1,
    overrides?.sourcePlanRevision ?? 1,
    listedAt,
    listedAt,
    overrides?.unlistedAt ?? null,
  ];
};

const record = (): ExplorePlanListingRecord => ({
  listing: {
    listingId: ExploreListingIdSchema.make("listing-1"),
    status: "LISTED",
    listingRevision: RevisionSchema.make(1),
    listedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    unlistedAt: undefined,
    snapshot: snapshot(1),
  } satisfies ExplorePlanListing,
  sourceTripId: TripIdSchema.make("trip-1"),
  sourcePlanId: PlanIdSchema.make("plan-1"),
  sourceAuthorParticipantId: ParticipantIdSchema.make("author-1"),
});

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

const provide = <A, E>(db: ReturnType<typeof makeDb>, effect: Effect.Effect<A, E, ExplorePlanRepository>) =>
  effect.pipe(
    Effect.provide(
      ExplorePlanRepositoryLive.pipe(Layer.provide(Layer.succeed(Database, { db })))
    )
  );

describe("ExplorePlanRepositoryLive", () => {
  // create INSERT는 이제 source trip_rooms row를 FOR UPDATE로 잠그고 source plan
  // 재검증 후에만 INSERT하는 transaction이다. 이 mock은 그 select 결과를
  // 모델링한다. drizzle은 { plans } projection을 positional array로 받는다.
  const sourceRoomRows = (
    plans: ReadonlyArray<{ readonly id: string; readonly revision: number }>
  ) => [[plans]];

  it("create 후 getById가 public envelope과 서버 전용 source ref를 분리해 round-trip decode한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      // create transaction: source room lock select → 기대 revision의 plan 존재.
      if (config.text.includes('from "trip_rooms"'))
        return { rows: sourceRoomRows([{ id: "plan-1", revision: 1 }]) };
      // INSERT ... ON CONFLICT DO NOTHING RETURNING "id" → 정상 삽입(1 row).
      if (config.text.startsWith("insert")) return { rows: [["listing-1"]] };
      // begin/commit 등 트랜잭션 제어문
      if (!config.text.startsWith("select")) return { rows: [] };
      // getById select
      return { rows: [row()] };
    }, calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          const created = yield* repository.create(record());
          const found = yield* repository.getById(
            ExploreListingIdSchema.make("listing-1")
          );
          return { created, found };
        })
      )
    );

    // public envelope round-trips
    expect(result.created).toEqual(record().listing);
    expect(result.found?.listing).toEqual(record().listing);
    // server-only source refs are on the record, NOT inside the public snapshot
    expect(result.found?.sourceTripId).toBe("trip-1");
    expect(result.found?.sourcePlanId).toBe("plan-1");
    expect(result.found?.sourceAuthorParticipantId).toBe("author-1");
    expect(Object.keys(result.found!.listing.snapshot)).not.toContain(
      "sourceTripId"
    );
    expect(JSON.stringify(result.found!.listing)).not.toContain("author-1");
    // create는 source room을 FOR UPDATE로 잠그고, 그 다음 private source
    // column을 실은 INSERT를 수행한다(순서/lock/SQL 증명).
    const lockSelect = calls.find(
      (c) => c.text.includes('from "trip_rooms"') && c.text.includes("for update")
    )!;
    expect(lockSelect).toBeDefined();
    expect(lockSelect.text).toContain('select "plans" from "trip_rooms"');
    expect(lockSelect.params).toContain("trip-1");
    const insert = calls.find((c) => c.text.startsWith("insert"))!;
    expect(insert.text).toContain('insert into "explore_plan_listings"');
    expect(insert.params).toContain("trip-1");
    expect(insert.params).toContain("plan-1");
    expect(insert.params).toContain("author-1");
    // FOR UPDATE lock select가 INSERT보다 먼저 실행된다(serialize 보장).
    expect(calls.indexOf(lockSelect)).toBeLessThan(calls.indexOf(insert));
  });

  it("create는 source room이 lock 하에서 사라졌으면 INSERT 없이 NotFound로 fail-closed한다", async () => {
    // concurrent delete가 먼저 커밋된 경우: FOR UPDATE 획득 후 trip_rooms row 없음.
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"')) return { rows: [] }; // room gone
      return { rows: [] };
    }, calls);

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.create(record());
          })
        )
      )
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ entity: "TripPlan", id: "plan-1" });
    // 삭제된 source에 대한 LISTED listing INSERT가 발생하지 않는다.
    expect(calls.some((c) => c.text.startsWith("insert"))).toBe(false);
  });

  it("create는 source plan이 사라졌으면(다른 plan만 남음) INSERT 없이 NotFound로 fail-closed한다", async () => {
    // room은 존재하지만 대상 source plan은 삭제됨(concurrent delete + auto-unlist race).
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"'))
        return { rows: [[[{ id: "other-plan", revision: 1 }]]] };
      return { rows: [] };
    }, calls);

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.create(record());
          })
        )
      )
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ entity: "TripPlan", id: "plan-1" });
    expect(calls.some((c) => c.text.startsWith("insert"))).toBe(false);
  });

  it("create는 source plan revision이 기대와 다르면 INSERT 없이 NotFound로 fail-closed한다", async () => {
    // plan은 존재하지만 revision이 snapshot의 sourcePlanRevision과 다름(중간 수정).
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"'))
        return { rows: [[[{ id: "plan-1", revision: 2 }]]] };
      return { rows: [] };
    }, calls);

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.create(record());
          })
        )
      )
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ entity: "TripPlan", id: "plan-1" });
    expect(calls.some((c) => c.text.startsWith("insert"))).toBe(false);
  });

  it("create는 concurrent first-list unique 충돌(ON CONFLICT DO NOTHING → 0 rows)에서 RepositoryError 대신 기존 LISTED listing을 idempotent하게 반환한다", async () => {
    // winner가 같은 source (trip-1, plan-1)에 대한 LISTED listing을 이미 만들었고,
    // loser의 INSERT는 unique index에 걸린다. adapter는 ON CONFLICT DO NOTHING이므로
    // 예외 대신 0 rows returning을 받고, 같은 tx에서 기존 row를 재조회한다.
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      // source room lock: 기대 revision의 plan 존재.
      if (config.text.includes('from "trip_rooms"'))
        return { rows: sourceRoomRows([{ id: "plan-1", revision: 1 }]) };
      // INSERT ... ON CONFLICT DO NOTHING RETURNING "id" → 충돌로 0 rows.
      if (config.text.startsWith("insert")) return { rows: [] };
      // conflict 후 재조회 select(source_trip_id/source_plan_id) → 기존 LISTED row.
      if (config.text.startsWith("select") && config.text.includes('"source_trip_id"'))
        return { rows: [row({ id: "listing-winner", status: "LISTED" })] };
      return { rows: [] };
    }, calls);

    const created = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.create(record());
        })
      )
    );

    // sequential findBySource(LISTED) 경로와 동일: winner의 기존 immutable listing 반환.
    expect(created.listingId).toBe("listing-winner");
    expect(created.status).toBe("LISTED");
    // INSERT는 ON CONFLICT DO NOTHING이며 returning "id"를 요청한다(raw 예외 없음).
    const insert = calls.find((c) => c.text.startsWith("insert"))!;
    expect(insert.text).toContain("on conflict");
    expect(insert.text).toContain("do nothing");
    expect(insert.text).toContain("returning");
    // conflict 이후 같은 source로 재조회가 일어난다.
    expect(
      calls.some(
        (c) => c.text.startsWith("select") && c.text.includes('"source_trip_id"')
      )
    ).toBe(true);
  });

  it("create는 concurrent 충돌 후 기존이 UNLISTED면 StateConflictError로 재게시를 요구한다", async () => {
    // winner가 만든 listing이 그 사이 UNLISTED가 된 경우: raw 503이 아니라
    // use case의 findBySource(UNLISTED) 분기와 같은 typed 의미(재게시 요구).
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"'))
        return { rows: sourceRoomRows([{ id: "plan-1", revision: 1 }]) };
      if (config.text.startsWith("insert")) return { rows: [] };
      if (config.text.startsWith("select") && config.text.includes('"source_trip_id"'))
        return {
          rows: [
            row({ id: "listing-winner", status: "UNLISTED", listingRevision: 2 }),
          ],
        };
      return { rows: [] };
    });

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.create(record());
          })
        )
      )
    );

    expect(error).toBeInstanceOf(StateConflictError);
    // RepositoryError(=503)로 새어 나가지 않는다.
    expect(error).not.toBeInstanceOf(RepositoryError);
  });

  it("malformed snapshot은 fallback 없이 RepositoryError로 실패한다", async () => {
    const db = makeDb(() => ({ rows: [row({ snapshot: { title: "broken" } })] }));

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.getById(
              ExploreListingIdSchema.make("listing-1")
            );
          })
        )
      )
    );

    expect(error).toBeInstanceOf(RepositoryError);
    expect(error).toMatchObject({ operation: "getExploreListing.decode" });
  });

  it("snapshot.sourcePlanRevision과 row column 불일치는 RepositoryError로 실패한다", async () => {
    // snapshot says revision 2 but the column says 1 -> corrupted stored state
    const db = makeDb(() => ({
      rows: [row({ snapshot: snapshot(2), sourcePlanRevision: 1 })],
    }));

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.getById(
              ExploreListingIdSchema.make("listing-1")
            );
          })
        )
      )
    );

    expect(error).toBeInstanceOf(RepositoryError);
  });

  it("relist는 source room을 FOR UPDATE로 먼저 잠그고 source revision 재검증 후 listing CAS를 수행한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"')) {
        return { rows: sourceRoomRows([{ id: "plan-1", revision: 7 }]) };
      }
      if (config.text.startsWith("update")) return { rows: [[3]] };
      return { rows: [] };
    }, calls);

    const current = record();
    const relistedRecord: ExplorePlanListingRecord = {
      ...current,
      listing: {
        ...current.listing,
        status: "LISTED",
        listingRevision: RevisionSchema.make(3),
        listedAt: "2026-09-03T00:00:00.000Z",
        updatedAt: "2026-09-03T00:00:00.000Z",
        snapshot: snapshot(7),
      },
    };

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.relist({
            record: relistedRecord,
            expectedListingRevision: RevisionSchema.make(2),
          });
        })
      )
    );

    expect(result.status).toBe("LISTED");
    expect(result.listingRevision).toBe(3);
    expect(result.snapshot.sourcePlanRevision).toBe(7);

    const lockSelect = calls.find(
      (call) =>
        call.text.includes('from "trip_rooms"') &&
        call.text.includes("for update")
    );
    const listingUpdate = calls.find(
      (call) =>
        call.text.startsWith("update") &&
        call.text.includes('"explore_plan_listings"')
    );
    expect(lockSelect).toBeDefined();
    expect(listingUpdate).toBeDefined();
    expect(lockSelect!.params).toContain("trip-1");
    expect(listingUpdate!.params).toContain("listing-1");
    expect(listingUpdate!.params).toContain(2);
    // delete와 동일한 room → listing lock order가 SQL 실행 순서로 고정된다.
    expect(calls.indexOf(lockSelect!)).toBeLessThan(
      calls.indexOf(listingUpdate!)
    );
  });

  it("relist source 검증 후 delete가 먼저 commit되면 lock 재검증에서 NotFound로 실패하고 listing은 UNLISTED로 남는다", async () => {
    // relist use case가 이미 source plan revision 7을 읽고 projection까지 만든 뒤,
    // transaction의 room lock을 얻기 전에 deletePlanAndAutoUnlist가 commit된
    // interleaving을 모델링한다. lock 시점에는 room에 source plan이 없다.
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    let persistedStatus: "UNLISTED" | "LISTED" = "UNLISTED";
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"')) {
        return { rows: sourceRoomRows([]) };
      }
      if (config.text.startsWith("update")) {
        persistedStatus = "LISTED";
        return { rows: [[3]] };
      }
      return { rows: [] };
    }, calls);

    const current = record();
    const relistedRecord: ExplorePlanListingRecord = {
      ...current,
      listing: {
        ...current.listing,
        status: "LISTED",
        listingRevision: RevisionSchema.make(3),
        listedAt: "2026-09-03T00:00:00.000Z",
        updatedAt: "2026-09-03T00:00:00.000Z",
        snapshot: snapshot(7),
      },
    };

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.relist({
              record: relistedRecord,
              expectedListingRevision: RevisionSchema.make(2),
            });
          })
        )
      )
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ entity: "TripPlan", id: "plan-1" });
    expect(persistedStatus).toBe("UNLISTED");
    // source가 사라진 뒤에는 LISTED CAS 자체가 실행되지 않는다.
    expect(
      calls.some(
        (call) =>
          call.text.startsWith("update") &&
          call.text.includes('"explore_plan_listings"')
      )
    ).toBe(false);
  });

  it("relist source 검증 후 edit가 먼저 commit되면 lock 하의 revision mismatch로 fail-closed한다", async () => {
    // use case는 revision 7 snapshot을 만들었지만 room lock 전에 source edit가
    // revision 8로 commit된 interleaving이다. stale projection을 게시하면 안 된다.
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.includes('from "trip_rooms"')) {
        return { rows: sourceRoomRows([{ id: "plan-1", revision: 8 }]) };
      }
      if (config.text.startsWith("update")) return { rows: [[3]] };
      return { rows: [] };
    }, calls);

    const current = record();
    const relistedRecord: ExplorePlanListingRecord = {
      ...current,
      listing: {
        ...current.listing,
        status: "LISTED",
        listingRevision: RevisionSchema.make(3),
        listedAt: "2026-09-03T00:00:00.000Z",
        updatedAt: "2026-09-03T00:00:00.000Z",
        snapshot: snapshot(7),
      },
    };

    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.relist({
              record: relistedRecord,
              expectedListingRevision: RevisionSchema.make(2),
            });
          })
        )
      )
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ entity: "TripPlan", id: "plan-1" });
    expect(
      calls.some(
        (call) =>
          call.text.startsWith("update") &&
          call.text.includes('"explore_plan_listings"')
      )
    ).toBe(false);
  });

  it("compareAndSet은 id+listing_revision 단일 UPDATE로 CAS한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb((config) => {
      if (config.text.startsWith("update")) return { rows: [[2]] };
      return { rows: [] };
    }, calls);

    const next = record();
    const updated = { ...next.listing, listingRevision: RevisionSchema.make(2), status: "UNLISTED" as const, unlistedAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" };

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.compareAndSet({
            record: { ...next, listing: updated },
            expectedListingRevision: RevisionSchema.make(1),
          });
        })
      )
    );

    expect(result.status).toBe("UNLISTED");
    const updateCall = calls.find((c) => c.text.startsWith("update"))!;
    expect(updateCall.text).toContain('update "explore_plan_listings"');
    expect(updateCall.text).toContain('"listing_revision" = $');
    expect(updateCall.text).toContain('"id" = $');
    expect(updateCall.text).toMatch(/"listing_revision" = \$\d+\)/);
    expect(updateCall.params).toContain(1); // expected revision in WHERE
  });

  it("stale compareAndSet은 현재 revision을 조회해 RevisionConflictError로 실패한다", async () => {
    const db = makeDb((config) => {
      if (config.text.startsWith("update")) return { rows: [] }; // no row matched
      if (config.text.startsWith("select")) return { rows: [[5]] }; // current revision
      return { rows: [] };
    });

    const next = record();
    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.compareAndSet({
              record: {
                ...next,
                listing: { ...next.listing, listingRevision: RevisionSchema.make(2) },
              },
              expectedListingRevision: RevisionSchema.make(1),
            });
          })
        )
      )
    );

    expect(error).toBeInstanceOf(RevisionConflictError);
    expect(error).toMatchObject({ expectedRevision: 1, actualRevision: 5 });
  });

  it("존재하지 않는 listing의 compareAndSet은 NotFoundError로 실패한다", async () => {
    const db = makeDb((config) => {
      if (config.text.startsWith("update")) return { rows: [] };
      if (config.text.startsWith("select")) return { rows: [] };
      return { rows: [] };
    });

    const next = record();
    const error = await Effect.runPromise(
      Effect.flip(
        provide(
          db,
          Effect.gen(function* () {
            const repository = yield* ExplorePlanRepository;
            return yield* repository.compareAndSet({
              record: next,
              expectedListingRevision: RevisionSchema.make(1),
            });
          })
        )
      )
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ entity: "ExplorePlanListing" });
  });

  it("listListed는 LISTED만 listed_at DESC,id DESC로 조회하고 limit+1로 nextCursor를 만든다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    // 3 rows returned for limit 2 -> hasMore, page = first 2, nextCursor from row[1]
    const db = makeDb(() => ({
      rows: [
        row({ id: "listing-a", listedAt: "2026-09-03T00:00:00.000Z" }),
        row({ id: "listing-b", listedAt: "2026-09-02T00:00:00.000Z" }),
        row({ id: "listing-c", listedAt: "2026-09-01T00:00:00.000Z" }),
      ],
    }), calls);

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.listListed({ limit: 2 });
        })
      )
    );

    expect(result.page.map((l) => l.listingId)).toEqual([
      "listing-a",
      "listing-b",
    ]);
    expect(result.nextCursor).toEqual({
      listedAt: "2026-09-02T00:00:00.000Z",
      listingId: "listing-b",
    });
    const select = calls[0];
    expect(select.text).toContain('"status" = $');
    expect(select.params).toContain("LISTED");
    expect(select.text).toContain('order by "explore_plan_listings"."listed_at" desc, "explore_plan_listings"."id" desc');
    expect(select.params).toContain(3); // limit + 1
  });

  it("listListed는 마지막 페이지에서 nextCursor 없이 반환한다", async () => {
    const db = makeDb(() => ({
      rows: [row({ id: "listing-a" })],
    }));

    const result = await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.listListed({ limit: 2 });
        })
      )
    );

    expect(result.page).toHaveLength(1);
    expect(result.nextCursor).toBeUndefined();
  });

  it("listListed cursor는 (listed_at,id) tuple-equivalent predicate로 UNLISTED와 중복을 제외한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb(() => ({ rows: [] }), calls);

    await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.listListed({
            limit: 2,
            cursor: {
              listedAt: "2026-09-02T00:00:00.000Z",
              listingId: ExploreListingIdSchema.make("listing-b"),
            },
          });
        })
      )
    );

    const select = calls[0];
    // status LISTED filter retained alongside keyset predicate
    expect(select.params).toContain("LISTED");
    // tuple predicate: listed_at < cursor OR (listed_at = cursor AND id < cursorId)
    expect(select.text).toContain('"listed_at" < $');
    expect(select.text).toContain('"listed_at" = $');
    expect(select.text).toContain('"id" < $');
    expect(select.text).toContain(" or ");
    expect(select.params).toContain("listing-b");
  });

  it("listListed는 LISTED public snapshot에 필터를 AND하고 keyset 정렬을 유지한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const db = makeDb(() => ({ rows: [] }), calls);

    await Effect.runPromise(
      provide(
        db,
        Effect.gen(function* () {
          const repository = yield* ExplorePlanRepository;
          return yield* repository.listListed({
            limit: 5,
            cursor: {
              listedAt: "2026-09-02T00:00:00.000Z",
              listingId: ExploreListingIdSchema.make("listing-b"),
            },
            filters: {
              query: "%교토_",
              destination: "간사이",
              routeCity: "오사카",
              startDate: "2026-10-01",
              endDate: "2026-10-31",
            },
          });
        })
      )
    );

    const select = calls[0];
    expect(select.text).toContain('from "explore_plan_listings"');
    expect(select.text).not.toContain('"trip_rooms"');
    expect(select.text).toContain('"status" = $');
    expect(select.text).toContain("jsonb_array_elements");
    expect(select.text).toContain("strpos");
    expect(select.text).not.toContain(" like ");
    expect(select.text).toContain("-> 'dateRange' ->> 'endDate' >= $");
    expect(select.text).toContain("-> 'dateRange' ->> 'startDate' <= $");
    expect(select.text).toContain('"listed_at" < $');
    expect(select.text).toContain('"listed_at" = $');
    expect(select.text).toContain('"id" < $');
    expect(select.text).toContain(
      'order by "explore_plan_listings"."listed_at" desc, "explore_plan_listings"."id" desc'
    );
    expect(select.params).toEqual(
      expect.arrayContaining([
        "LISTED",
        "%교토_",
        "간사이",
        "오사카",
        "2026-10-01",
        "2026-10-31",
        "listing-b",
        6,
      ])
    );
  });
});
