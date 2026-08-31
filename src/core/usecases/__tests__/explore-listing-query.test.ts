import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import {
  ExploreListingIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
  type ExploreListingId,
} from "../../domain/ids.ts";
import type { ExplorePlanSnapshot } from "../../domain/explore-plan.ts";
import type { UserSession } from "../../domain/room.ts";
import { SessionService } from "../../ports/session.ts";
import {
  ExplorePlanRepository,
  type ExplorePopularCity,
  type ExploreListingCursor,
  type ExplorePlanListingRecord,
  type ListListedParams,
  type ListListedResult,
} from "../../ports/explore-plan-repository.ts";
import {
  ExploreListingUnavailableError,
  NotFoundError,
  UnauthorizedError,
} from "../../domain/errors.ts";
import {
  getExploreListingDetail,
  listPopularExploreCities,
  listExploreListings,
} from "../explore-listing.ts";

// --- fixtures ---------------------------------------------------------------

const registeredSession: UserSession = {
  participantId: UserIdSchema.make("user-viewer"),
  participantIds: [UserIdSchema.make("user-viewer")],
  accountType: "REGISTERED",
  name: "조회자",
  isAuthenticated: true,
};

const guestSession: UserSession = {
  participantId: UserIdSchema.make("user-guest"),
  participantIds: [UserIdSchema.make("user-guest")],
  accountType: "GUEST",
  name: "게스트",
  isAuthenticated: true,
};

const unauthenticatedSession: UserSession = {
  participantId: UserIdSchema.make("user-anon"),
  participantIds: [UserIdSchema.make("user-anon")],
  accountType: "GUEST",
  name: "비로그인",
  isAuthenticated: false,
};

const snapshot = (title: string): ExplorePlanSnapshot => ({
  title,
  destination: "제주도",
  routes: [{ city: "제주도", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
  stays: [],
  transports: [],
  author: { displayName: "작성자" },
  sourcePlanRevision: RevisionSchema.make(3),
});

const listedRecord = (
  id: string,
  listedAt: string
): ExplorePlanListingRecord => ({
  listing: {
    listingId: ExploreListingIdSchema.make(id),
    status: "LISTED",
    listingRevision: RevisionSchema.make(1),
    listedAt,
    updatedAt: listedAt,
    snapshot: snapshot(`plan ${id}`),
  },
  sourceTripId: TripIdSchema.make(`trip-${id}`),
  sourcePlanId: PlanIdSchema.make(`plan-${id}`),
  sourceAuthorParticipantId: UserIdSchema.make(`author-${id}`),
});

const unlistedRecord = (
  id: string,
  listedAt: string
): ExplorePlanListingRecord => ({
  ...listedRecord(id, listedAt),
  listing: {
    ...listedRecord(id, listedAt).listing,
    status: "UNLISTED",
    unlistedAt: "2026-09-10T00:00:00.000Z",
  },
});

// --- keyset repository fake -------------------------------------------------

/**
 * Drizzle adapter와 동일한 결정적 keyset 정렬(`listedAt DESC, listingId DESC`)을
 * 재현하는 fake. UNLISTED는 제외하고, cursor 이후 row만 반환하며, limit+1로 다음
 * 페이지 존재를 판단한다. 이 fake로 use case가 반환하는 page/nextCursor를 이어붙였을
 * 때 duplicate/missing이 없는지 검증한다.
 */
const compareDesc = (a: ExplorePlanListingRecord, b: ExplorePlanListingRecord) => {
  if (a.listing.listedAt !== b.listing.listedAt) {
    return a.listing.listedAt < b.listing.listedAt ? 1 : -1;
  }
  if (a.listing.listingId === b.listing.listingId) return 0;
  return a.listing.listingId < b.listing.listingId ? 1 : -1;
};

const isBeforeCursor = (
  record: ExplorePlanListingRecord,
  cursor: ExploreListingCursor
): boolean => {
  const { listedAt, listingId } = record.listing;
  if (listedAt !== cursor.listedAt) return listedAt < cursor.listedAt;
  return listingId < cursor.listingId;
};

const keysetExploreRepo = (
  all: ReadonlyArray<ExplorePlanListingRecord>,
  onListListed?: (params: ListListedParams) => void,
  popularCities: ReadonlyArray<ExplorePopularCity> = []
): Layer.Layer<ExplorePlanRepository> =>
  Layer.succeed(ExplorePlanRepository, {
    create: () => Effect.die("not implemented"),
    getById: () => Effect.die("not implemented"),
    getPublicById: () => Effect.die("not implemented"),
    findBySource: () => Effect.die("not implemented"),
    relist: () => Effect.die("not implemented"),
    compareAndSet: () => Effect.die("not implemented"),
    listListed: (params: ListListedParams): Effect.Effect<ListListedResult> => {
      onListListed?.(params);
      const listed = all
        .filter((r) => r.listing.status === "LISTED")
        .sort(compareDesc)
        .filter((r) => (params.cursor ? isBeforeCursor(r, params.cursor) : true));

      const window = listed.slice(0, params.limit + 1);
      const hasMore = window.length > params.limit;
      const pageRecords = hasMore ? window.slice(0, params.limit) : window;
      const page = pageRecords.map((r) => ({ ...r.listing, saveCount: 0 }));
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last
          ? {
              rankedAt: params.rankedAt ?? "2026-09-01T00:00:00.000Z",
              rankScore: 0,
              listedAt: last.listedAt,
              listingId: last.listingId,
            }
          : undefined;
      return Effect.succeed({
        page,
        nextCursor,
        rankingMode: "RECENCY_FALLBACK" as const,
      });
    },
    listPopularCities: () => Effect.succeed(popularCities),
  });

const sessionLayer = (session: UserSession): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, {
    getCurrentSession: () => Effect.succeed(session),
    getCurrentUser: () =>
      session.isAuthenticated
        ? Effect.succeed(session)
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
  });

const runQuery = <A, E>(
  effect: Effect.Effect<A, E, ExplorePlanRepository | SessionService>,
  opts: {
    session: UserSession;
    records: ReadonlyArray<ExplorePlanListingRecord>;
    onListListed?: (params: ListListedParams) => void;
    popularCities?: ReadonlyArray<ExplorePopularCity>;
  }
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          sessionLayer(opts.session),
          keysetExploreRepo(opts.records, opts.onListListed, opts.popularCities)
        )
      )
    ) as Effect.Effect<A, E, never>
  );

const runAndCatch = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
    return new Error("__NO_FAILURE__");
  } catch (error) {
    return error;
  }
};

// --- tests ------------------------------------------------------------------

describe("RAON-260 listExploreListings (read query)", () => {
  it("미인증 세션은 UnauthorizedError로 거부한다", async () => {
    expect(
      await runAndCatch(
        runQuery(listExploreListings({ limit: 10 }), {
          session: unauthenticatedSession,
          records: [listedRecord("a", "2026-09-05T00:00:00.000Z")],
        })
      )
    ).toBeInstanceOf(UnauthorizedError);
  });

  it("registered 세션은 다른 Trip membership 없이도 sanitized listing을 조회한다", async () => {
    const result = await runQuery(listExploreListings({ limit: 10 }), {
      session: registeredSession,
      records: [listedRecord("a", "2026-09-05T00:00:00.000Z")],
    });
    expect(result.page).toHaveLength(1);
    // public envelope만: server-only source reference가 없다.
    expect("sourceTripId" in result.page[0]!).toBe(false);
    expect("sourcePlanId" in result.page[0]!).toBe(false);
    expect("sourceAuthorParticipantId" in result.page[0]!).toBe(false);
  });

  it("GUEST 세션도(등록 불필요) authenticated면 조회할 수 있다", async () => {
    const result = await runQuery(listExploreListings({ limit: 10 }), {
      session: guestSession,
      records: [listedRecord("a", "2026-09-05T00:00:00.000Z")],
    });
    expect(result.page).toHaveLength(1);
  });

  it("LISTED만 반환하고 UNLISTED는 제외한다", async () => {
    const result = await runQuery(listExploreListings({ limit: 10 }), {
      session: registeredSession,
      records: [
        listedRecord("a", "2026-09-05T00:00:00.000Z"),
        unlistedRecord("b", "2026-09-06T00:00:00.000Z"),
      ],
    });
    expect(result.page.map((l) => l.listingId)).toEqual(["a"]);
  });

  it("limit/cursor/filter를 repository listListed로 그대로 전달한다", async () => {
    const seen: ListListedParams[] = [];
    const filters = {
      query: "교토",
      destination: "간사이",
      routeCity: "오사카",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    };
    await runQuery(listExploreListings({ limit: 7, filters }), {
      session: registeredSession,
      records: [listedRecord("a", "2026-09-05T00:00:00.000Z")],
      onListListed: (params) => seen.push(params),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ limit: 7, cursor: undefined, filters });
    expect(seen[0]?.rankedAt).toMatch(/Z$/);
  });

  it("동점 listedAt에서도 listingId DESC로 결정적 정렬한다", async () => {
    // 같은 listedAt, 다른 listingId → id 역순(z, m, a).
    const tie = "2026-09-05T00:00:00.000Z";
    const result = await runQuery(listExploreListings({ limit: 10 }), {
      session: registeredSession,
      records: [
        listedRecord("a", tie),
        listedRecord("z", tie),
        listedRecord("m", tie),
      ],
    });
    expect(result.page.map((l) => l.listingId)).toEqual(["z", "m", "a"]);
  });

  it("페이지를 이어붙이면 tie timestamp가 섞여 있어도 중복/누락이 없다", async () => {
    // 8개 중 4개가 동일 listedAt(tie), 나머지는 서로 다른 시각.
    const tie = "2026-09-05T00:00:00.000Z";
    const records: ExplorePlanListingRecord[] = [
      listedRecord("l1", "2026-09-08T00:00:00.000Z"),
      listedRecord("l2", "2026-09-07T00:00:00.000Z"),
      listedRecord("t-a", tie),
      listedRecord("t-b", tie),
      listedRecord("t-c", tie),
      listedRecord("t-d", tie),
      listedRecord("l3", "2026-09-02T00:00:00.000Z"),
      listedRecord("l4", "2026-09-01T00:00:00.000Z"),
    ];

    const collected: ExploreListingId[] = [];
    let cursor: ExploreListingCursor | undefined;
    let guard = 0;
    do {
      const result = await runQuery(
        listExploreListings({ limit: 3, cursor }),
        { session: registeredSession, records }
      );
      collected.push(...result.page.map((l) => l.listingId));
      cursor = result.nextCursor;
      guard += 1;
      expect(guard).toBeLessThan(10); // 무한 루프 방지
    } while (cursor);

    // 전체 개수 = 누락/중복 없음.
    expect(collected).toHaveLength(records.length);
    expect(new Set(collected).size).toBe(records.length);
    // 순서: listedAt DESC, listingId DESC. tie 블록은 id 역순.
    expect(collected).toEqual([
      "l1",
      "l2",
      "t-d",
      "t-c",
      "t-b",
      "t-a",
      "l3",
      "l4",
    ]);
  });

  it("마지막 페이지는 nextCursor 없이 반환한다", async () => {
    const result = await runQuery(listExploreListings({ limit: 10 }), {
      session: registeredSession,
      records: [
        listedRecord("a", "2026-09-05T00:00:00.000Z"),
        listedRecord("b", "2026-09-04T00:00:00.000Z"),
      ],
    });
    expect(result.page).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });
});

describe("RAON-272 listPopularExploreCities", () => {
  it("authenticated session만 요구하고 repository aggregate를 그대로 반환한다", async () => {
    const items: ReadonlyArray<ExplorePopularCity> = [
      { cityId: "osaka", listingCount: 3 },
    ];
    const result = await runQuery(listPopularExploreCities(), {
      session: registeredSession,
      records: [],
      popularCities: items,
    });

    expect(result).toEqual({ items });
  });

  it("aggregate 결과가 없으면 빈 items를 반환한다", async () => {
    await expect(
      runQuery(listPopularExploreCities(), {
        session: registeredSession,
        records: [],
      })
    ).resolves.toEqual({ items: [] });
  });
});

// --- detail read (RAON-263 DISC-5) -----------------------------------------

/**
 * getById만 구현한 fake. list/mutation은 die로 두어 detail read가 오직 getById만
 * 사용함을 강제한다. TripRoomRepository는 layer에 아예 제공하지 않으므로, detail
 * read가 private aggregate를 read-through하면 requirements 불충족으로 컴파일/실행이
 * 실패한다(구조적 차단).
 */
const getByIdExploreRepo = (
  record: ExplorePlanListingRecord | undefined
): Layer.Layer<ExplorePlanRepository> =>
  Layer.succeed(ExplorePlanRepository, {
    create: () => Effect.die("not implemented"),
    getById: () => Effect.succeed(record),
    getPublicById: () =>
      Effect.succeed(record ? { ...record.listing, saveCount: 0 } : undefined),
    findBySource: () => Effect.die("not implemented"),
    relist: () => Effect.die("not implemented"),
    compareAndSet: () => Effect.die("not implemented"),
    listListed: () => Effect.die("not implemented"),
    listPopularCities: () => Effect.die("not implemented"),
  });

const runDetail = <A, E>(
  effect: Effect.Effect<A, E, ExplorePlanRepository | SessionService>,
  opts: {
    session: UserSession;
    record: ExplorePlanListingRecord | undefined;
  }
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          sessionLayer(opts.session),
          getByIdExploreRepo(opts.record)
        )
      )
    ) as Effect.Effect<A, E, never>
  );

describe("RAON-263 getExploreListingDetail (detail read)", () => {
  const listingId = ExploreListingIdSchema.make("listing-detail");

  it("미인증 세션은 UnauthorizedError로 거부한다(private read 없이)", async () => {
    expect(
      await runAndCatch(
        runDetail(getExploreListingDetail({ listingId }), {
          session: unauthenticatedSession,
          record: listedRecord("detail", "2026-09-05T00:00:00.000Z"),
        })
      )
    ).toBeInstanceOf(UnauthorizedError);
  });

  it("LISTED면 public envelope만 반환한다(source ref 없음)", async () => {
    const result = await runDetail(getExploreListingDetail({ listingId }), {
      session: registeredSession,
      record: listedRecord("detail", "2026-09-05T00:00:00.000Z"),
    });
    expect(result.status).toBe("LISTED");
    expect("sourceTripId" in result).toBe(false);
    expect("sourcePlanId" in result).toBe(false);
    expect("sourceAuthorParticipantId" in result).toBe(false);
  });

  it("GUEST 세션도 authenticated면 LISTED detail을 조회할 수 있다", async () => {
    const result = await runDetail(getExploreListingDetail({ listingId }), {
      session: guestSession,
      record: listedRecord("detail", "2026-09-05T00:00:00.000Z"),
    });
    expect(result.status).toBe("LISTED");
  });

  it("UNLISTED면 ExploreListingUnavailableError(410 의미)로 실패한다", async () => {
    expect(
      await runAndCatch(
        runDetail(getExploreListingDetail({ listingId }), {
          session: registeredSession,
          record: unlistedRecord("detail", "2026-09-05T00:00:00.000Z"),
        })
      )
    ).toBeInstanceOf(ExploreListingUnavailableError);
  });

  it("record가 없으면(deleted/invalid) NotFoundError로 실패한다", async () => {
    expect(
      await runAndCatch(
        runDetail(getExploreListingDetail({ listingId }), {
          session: registeredSession,
          record: undefined,
        })
      )
    ).toBeInstanceOf(NotFoundError);
  });

  it("detail read의 requirements는 TripRoomRepository를 포함하지 않는다(타입 수준)", () => {
    // 아래 effect를 SessionService + ExplorePlanRepository만으로 provide할 수 있으면
    // TripRoomRepository 의존이 없음이 타입으로 증명된다. TripRoomRepository가 요구되면
    // 이 provide는 컴파일되지 않는다.
    const provided: Effect.Effect<unknown, unknown, never> =
      getExploreListingDetail({ listingId }).pipe(
        Effect.provide(
          Layer.mergeAll(
            sessionLayer(registeredSession),
            getByIdExploreRepo(undefined)
          )
        )
      );
    expect(provided).toBeDefined();
  });
});
