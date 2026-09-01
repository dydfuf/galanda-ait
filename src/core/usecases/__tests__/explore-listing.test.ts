import { describe, expect, it } from "vitest";
import { Clock, Effect, Layer } from "effect";
import {
  ExploreListingIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
  type ExploreListingId,
  type Revision,
  type TripId,
} from "../../domain/ids.ts";
import type {
  TripMember,
  TripPlan,
  TripRoom,
  UserSession,
} from "../../domain/room.ts";
import type { ExploreThemeId } from "../../domain/explore-theme.ts";
import { SessionService } from "../../ports/session.ts";
import { TripRoomRepository } from "../../ports/trip-room-repository.ts";
import {
  ExplorePlanRepository,
  type ExplorePlanListingRecord,
} from "../../ports/explore-plan-repository.ts";
import {
  NotFoundError,
  RevisionConflictError,
  ForbiddenError,
  StateConflictError,
  ValidationError,
  UnauthorizedError,
  AccountUpgradeRequiredError,
} from "../../domain/errors.ts";
import { createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import type { IdGenerator } from "../../ports/id-generator.ts";
import {
  classifyExploreListing,
  listPlanInExplore,
  relistPlanInExplore,
  unlistPlanFromExplore,
} from "../explore-listing.ts";

// --- fixtures ---------------------------------------------------------------

const hostUser: TripMember = {
  id: UserIdSchema.make("user-host"),
  name: "방장",
  role: "HOST",
};
const authorUser: TripMember = {
  id: UserIdSchema.make("user-author"),
  name: "작성자",
  role: "MEMBER",
};
const outsiderId = UserIdSchema.make("user-outsider");

const publishablePlanFields = {
  baseHeadcount: 2,
  routes: [{ city: "제주도", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  accommodations: [
    {
      id: "stay-jeju",
      city: "제주도",
      period: "2026-09-01 ~ 2026-09-04",
      nights: 3,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
  transports: [
    {
      id: "outbound-jeju",
      fromCity: "서울",
      toCity: "제주도",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED" as const,
    },
    {
      id: "return-jeju",
      fromCity: "제주도",
      toCity: "서울",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
};

const authorPlan: TripPlan = {
  id: PlanIdSchema.make("plan-author-1"),
  title: "작성자의 여행안",
  status: "VOTING",
  authorId: authorUser.id,
  authorName: authorUser.name,
  revision: RevisionSchema.make(3),
  publishedAt: "2026-08-24T00:00:00.000Z",
  ...publishablePlanFields,
  places: [],
  memberOpinions: [],
  voteCount: 0,
};

const hostPlan: TripPlan = {
  ...authorPlan,
  id: PlanIdSchema.make("plan-host-1"),
  title: "방장의 여행안",
  authorId: hostUser.id,
  authorName: hostUser.name,
};

const sampleRoom: TripRoom = {
  id: TripIdSchema.make("room-101"),
  title: "제주도 3박 4일",
  destination: "제주도",
  revision: RevisionSchema.make(1),
  members: [hostUser, authorUser],
  plans: [authorPlan, hostPlan],
  confirmedPlanId: undefined,
};

const registeredSession = (member: TripMember): UserSession => ({
  participantId: member.id,
  participantIds: [member.id],
  accountType: "REGISTERED",
  name: member.name,
  isAuthenticated: true,
});

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

const outsiderSession: UserSession = {
  participantId: outsiderId,
  participantIds: [outsiderId],
  accountType: "REGISTERED",
  name: "외부인",
  isAuthenticated: true,
};

// --- fakes ------------------------------------------------------------------

const sessionLayer = (session: UserSession): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, {
    getCurrentSession: () => Effect.succeed(session),
    getCurrentUser: () =>
      session.isAuthenticated
        ? Effect.succeed(session)
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
  });

const tripRepoLayer = (
  rooms: ReadonlyArray<TripRoom>
): Layer.Layer<TripRoomRepository> =>
  Layer.succeed(TripRoomRepository, {
    getRoom: (roomId: TripId) => {
      const found = rooms.find((r) => r.id === roomId);
      return found
        ? Effect.succeed(found)
        : Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
    },
    getRooms: () => Effect.succeed(rooms),
    getRoomOverviewRecords: () => Effect.die("not implemented"),
    createRoom: () => Effect.die("not implemented"),
    updateRoom: () => Effect.die("not implemented"),
    createPlan: () => Effect.die("not implemented"),
    updatePlan: () => Effect.die("not implemented"),
    saveRoom: () => Effect.die("not implemented"),
    saveRoomWithActivity: () => Effect.die("not implemented"),
    deletePlanAndAutoUnlist: () => Effect.die("not implemented"),
  });

interface FakeExploreState {
  readonly records: Map<ExploreListingId, ExplorePlanListingRecord>;
  readonly created: ExplorePlanListingRecord[];
  readonly cas: Array<{ id: ExploreListingId; expected: Revision }>;
  afterGet: (() => void) | undefined;
}

const exploreRepoLayer = (
  state: FakeExploreState
): Layer.Layer<ExplorePlanRepository> =>
  Layer.succeed(ExplorePlanRepository, {
    create: ({ record }) => {
      state.records.set(record.listing.listingId, record);
      state.created.push(record);
      return Effect.succeed(record.listing);
    },
    getById: (listingId) =>
      Effect.sync(() => {
        const record = state.records.get(listingId);
        const afterGet = state.afterGet;
        state.afterGet = undefined;
        afterGet?.();
        return record;
      }),
    getPublicById: () => Effect.die("not implemented"),
    findBySource: (sourceTripId, sourcePlanId) => {
      for (const record of state.records.values()) {
        if (
          record.sourceTripId === sourceTripId &&
          record.sourcePlanId === sourcePlanId
        ) {
          return Effect.succeed(record);
        }
      }
      return Effect.succeed(undefined);
    },
    relist: ({ record, expectedListingRevision }) => {
      state.cas.push({
        id: record.listing.listingId,
        expected: expectedListingRevision,
      });
      const current = state.records.get(record.listing.listingId);
      if (!current) {
        return Effect.fail(
          new NotFoundError({
            entity: "ExplorePlanListing",
            id: record.listing.listingId,
          })
        );
      }
      if (current.listing.listingRevision !== expectedListingRevision) {
        return Effect.fail(
          new RevisionConflictError({
            message: "conflict",
            expectedRevision: expectedListingRevision,
            actualRevision: current.listing.listingRevision,
          })
        );
      }
      state.records.set(record.listing.listingId, record);
      return Effect.succeed(record.listing);
    },
    compareAndSet: ({ record, expectedListingRevision }) => {
      state.cas.push({
        id: record.listing.listingId,
        expected: expectedListingRevision,
      });
      const current = state.records.get(record.listing.listingId);
      if (!current) {
        return Effect.fail(
          new NotFoundError({
            entity: "ExplorePlanListing",
            id: record.listing.listingId,
          })
        );
      }
      if (current.listing.listingRevision !== expectedListingRevision) {
        return Effect.fail(
          new RevisionConflictError({
            message: "conflict",
            expectedRevision: expectedListingRevision,
            actualRevision: current.listing.listingRevision,
          })
        );
      }
      state.records.set(record.listing.listingId, record);
      return Effect.succeed(record.listing);
    },
    listListed: () =>
      Effect.succeed({
        page: [],
        nextCursor: undefined,
        rankingMode: "RECENCY_FALLBACK" as const,
      }),
    listPopularCities: () => Effect.succeed([]),
  });

const makeState = (
  seed: ReadonlyArray<ExplorePlanListingRecord> = []
): FakeExploreState => {
  const records = new Map<ExploreListingId, ExplorePlanListingRecord>();
  for (const record of seed) records.set(record.listing.listingId, record);
  return { records, created: [], cas: [], afterGet: undefined };
};

const idLayer = (
  exploreListingId = "listing-new-1"
): Layer.Layer<IdGenerator> => createTestIdGenerator({ exploreListingId });

const makeFixedClock = (iso: string): Clock.Clock => {
  const millis = new Date(iso).getTime();
  const nanos = BigInt(millis) * 1_000_000n;
  return {
    currentTimeMillisUnsafe: () => millis,
    currentTimeMillis: Effect.succeed(millis),
    currentTimeNanosUnsafe: () => nanos,
    currentTimeNanos: Effect.succeed(nanos),
    monotonicTimeNanosUnsafe: () => nanos,
    monotonicTimeNanos: Effect.succeed(nanos),
    sleep: () => Effect.void,
  };
};

const runWith = <A, E>(
  effect: Effect.Effect<A, E, any>,
  opts: {
    session: UserSession;
    rooms?: ReadonlyArray<TripRoom>;
    state?: FakeExploreState;
    exploreListingId?: string;
    nowIso?: string;
  }
): Promise<A> => {
  const state = opts.state ?? makeState();
  const base = Layer.mergeAll(
    sessionLayer(opts.session),
    tripRepoLayer(opts.rooms ?? [sampleRoom]),
    exploreRepoLayer(state),
    idLayer(opts.exploreListingId)
  );
  const provided = effect.pipe(Effect.provide(base));
  const program = opts.nowIso
    ? provided.pipe(
        Effect.provideService(Clock.Clock, makeFixedClock(opts.nowIso))
      )
    : provided;
  return Effect.runPromise(program as Effect.Effect<A, E, never>);
};

const runAndCatch = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
    return new Error("__NO_FAILURE__");
  } catch (error) {
    return error;
  }
};

// listing record helper for unlist/relist seeds.
const seedListing = (over?: {
  status?: "LISTED" | "UNLISTED";
  listingRevision?: number;
  sourceAuthorParticipantId?: TripMember["id"];
  listedAt?: string;
  unlistedAt?: string;
  snapshotRevision?: number;
  themeIds?: ReadonlyArray<ExploreThemeId>;
}): ExplorePlanListingRecord => ({
  listing: {
    listingId: ExploreListingIdSchema.make("listing-seed-1"),
    status: over?.status ?? "LISTED",
    listingRevision: RevisionSchema.make(over?.listingRevision ?? 1),
    listedAt: over?.listedAt ?? "2026-08-25T00:00:00.000Z",
    updatedAt: over?.listedAt ?? "2026-08-25T00:00:00.000Z",
    unlistedAt: over?.unlistedAt,
    snapshot: {
      title: authorPlan.title,
      destination: sampleRoom.destination,
      routes: authorPlan.routes!.map((r) => ({
        city: r.city,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
      })),
      dateRange: {
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        nightCount: 3,
      },
      stays: [],
      transports: [],
      author: { displayName: authorUser.name },
      sourcePlanRevision: RevisionSchema.make(over?.snapshotRevision ?? 3),
      themeIds: over?.themeIds,
    },
  },
  sourceTripId: sampleRoom.id,
  sourcePlanId: authorPlan.id,
  sourceAuthorParticipantId: over?.sourceAuthorParticipantId ?? authorUser.id,
});

// --- tests ------------------------------------------------------------------

describe("RAON-259 listPlanInExplore", () => {
  it("registered author가 게시하면 새 listing을 LISTED/revision=1/생성 시각으로 저장한다", async () => {
    const state = makeState();
    const listing = await runWith(
      listPlanInExplore({
        sourceTripId: sampleRoom.id,
        sourcePlanId: authorPlan.id,
        themeIds: ["nature", "food"],
      }),
      {
        session: registeredSession(authorUser),
        state,
        exploreListingId: "listing-new-1",
        nowIso: "2026-08-26T10:00:00.000Z",
      }
    );

    expect(listing.listingId).toBe("listing-new-1");
    expect(listing.status).toBe("LISTED");
    expect(listing.listingRevision).toBe(1);
    expect(listing.listedAt).toBe("2026-08-26T10:00:00.000Z");
    expect(listing.updatedAt).toBe(listing.listedAt);
    expect(listing.unlistedAt).toBeUndefined();
    // server-side projection: source revision을 고정하고 표시명을 채운다.
    expect(listing.snapshot.sourcePlanRevision).toBe(3);
    expect(listing.snapshot.author.displayName).toBe(authorUser.name);
    expect(listing.snapshot.themeIds).toEqual(["food", "nature"]);
    // server-only source reference는 저장되되 public listing에는 없다.
    expect(state.created[0]!.sourceAuthorParticipantId).toBe(authorUser.id);
    expect("sourceTripId" in listing).toBe(false);
    expect("sourcePlanId" in listing).toBe(false);
  });

  it("미인증 세션은 UnauthorizedError로 거부한다", async () => {
    expect(await runAndCatch(runWith(
        listPlanInExplore({ sourceTripId: sampleRoom.id, sourcePlanId: authorPlan.id }),
        { session: unauthenticatedSession }
      ))).toBeInstanceOf(UnauthorizedError);
  });

  it("GUEST 계정은 AccountUpgradeRequiredError로 거부한다", async () => {
    expect(await runAndCatch(runWith(
        listPlanInExplore({ sourceTripId: sampleRoom.id, sourcePlanId: authorPlan.id }),
        { session: guestSession }
      ))).toBeInstanceOf(AccountUpgradeRequiredError);
  });

  it("room 비참여자(outsider)에게는 NotFound로 존재를 숨긴다(oracle 방지)", async () => {
    const error = await runAndCatch(runWith(
        listPlanInExplore({ sourceTripId: sampleRoom.id, sourcePlanId: authorPlan.id }),
        { session: outsiderSession }
      ));
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).entity).toBe("TripRoom");
  });

  it("존재하지 않는 plan은 NotFound(TripPlan)로 거부한다", async () => {
    const error = await runAndCatch(runWith(
        listPlanInExplore({
          sourceTripId: sampleRoom.id,
          sourcePlanId: PlanIdSchema.make("plan-missing"),
        }),
        { session: registeredSession(authorUser) }
      ));
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).entity).toBe("TripPlan");
  });

  it("HOST라도 타인 plan은 게시할 수 없다(strict author only, legacy HOST fallback 미사용)", async () => {
    expect(await runAndCatch(runWith(
        listPlanInExplore({
          sourceTripId: sampleRoom.id,
          sourcePlanId: authorPlan.id,
        }),
        { session: registeredSession(hostUser) }
      ))).toBeInstanceOf(ForbiddenError);
  });

  it("plan.revision이 없으면 ValidationError로 거부한다", async () => {
    const noRevisionPlan: TripPlan = { ...authorPlan, revision: undefined };
    const roomNoRev: TripRoom = { ...sampleRoom, plans: [noRevisionPlan] };
    expect(await runAndCatch(runWith(
        listPlanInExplore({
          sourceTripId: sampleRoom.id,
          sourcePlanId: authorPlan.id,
        }),
        { session: registeredSession(authorUser), rooms: [roomNoRev] }
      ))).toBeInstanceOf(ValidationError);
  });

  it("이미 LISTED면 기존 immutable snapshot을 그대로 반환하고 live sync/create하지 않는다", async () => {
    const seeded = seedListing({ status: "LISTED", snapshotRevision: 3 });
    const state = makeState([seeded]);
    // source plan revision을 5로 올려도 반환 snapshot은 기존(3)이어야 한다.
    const roomWithNewerPlan: TripRoom = {
      ...sampleRoom,
      plans: [{ ...authorPlan, revision: RevisionSchema.make(5) }, hostPlan],
    };

    const listing = await runWith(
      listPlanInExplore({ sourceTripId: sampleRoom.id, sourcePlanId: authorPlan.id }),
      { session: registeredSession(authorUser), state, rooms: [roomWithNewerPlan] }
    );

    expect(listing.listingId).toBe(seeded.listing.listingId);
    expect(listing.snapshot.sourcePlanRevision).toBe(3);
    expect(state.created).toHaveLength(0);
  });

  it("이미 UNLISTED면 explicit relist를 요구하는 StateConflict로 거부한다", async () => {
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 2 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        listPlanInExplore({ sourceTripId: sampleRoom.id, sourcePlanId: authorPlan.id }),
        { session: registeredSession(authorUser), state }
      ))).toBeInstanceOf(StateConflictError);
    expect(state.created).toHaveLength(0);
  });
});

describe("RAON-259 unlistPlanFromExplore", () => {
  it("author가 LISTED를 UNLISTED로 전이하고 revision+1·unlistedAt=updatedAt=now·listedAt/snapshot 유지·CAS", async () => {
    const seeded = seedListing({
      status: "LISTED",
      listingRevision: 1,
      listedAt: "2026-08-25T00:00:00.000Z",
    });
    const state = makeState([seeded]);

    const listing = await runWith(
      unlistPlanFromExplore({
        listingId: seeded.listing.listingId,
        expectedRevision: RevisionSchema.make(1),
      }),
      {
        session: registeredSession(authorUser),
        state,
        nowIso: "2026-08-27T00:00:00.000Z",
      }
    );

    expect(listing.status).toBe("UNLISTED");
    expect(listing.listingRevision).toBe(2);
    expect(listing.updatedAt).toBe("2026-08-27T00:00:00.000Z");
    expect(listing.unlistedAt).toBe("2026-08-27T00:00:00.000Z");
    expect(listing.listedAt).toBe("2026-08-25T00:00:00.000Z");
    expect(listing.snapshot).toEqual(seeded.listing.snapshot);
    // CAS: expected는 기존 revision(1)이어야 한다.
    expect(state.cas[0]).toEqual({ id: seeded.listing.listingId, expected: 1 });
  });

  it("존재하지 않는 listing은 NotFound로 거부한다", async () => {
    expect(await runAndCatch(runWith(
        unlistPlanFromExplore({
          listingId: ExploreListingIdSchema.make("listing-missing"),
          expectedRevision: RevisionSchema.make(1),
        }),
        { session: registeredSession(authorUser) }
      ))).toBeInstanceOf(NotFoundError);
  });

  it("listing author가 아니면 ForbiddenError로 거부한다", async () => {
    const seeded = seedListing({ sourceAuthorParticipantId: authorUser.id });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        unlistPlanFromExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(1),
        }),
        { session: registeredSession(hostUser), state }
      ))).toBeInstanceOf(ForbiddenError);
  });

  it("이미 UNLISTED면 StateConflict로 거부한다", async () => {
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 2 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        unlistPlanFromExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(2),
        }),
        { session: registeredSession(authorUser), state }
      ))).toBeInstanceOf(StateConflictError);
  });

  it("이미 UNLISTED여도 expectedRevision이 stale이면 RevisionConflict를 먼저 반환한다", async () => {
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 2 });
    const state = makeState([seeded]);

    expect(await runAndCatch(runWith(
        unlistPlanFromExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(1),
        }),
        { session: registeredSession(authorUser), state }
      ))).toBeInstanceOf(RevisionConflictError);
    expect(state.cas).toEqual([]);
  });

  it("stale expectedRevision이면 repository CAS가 RevisionConflict로 실패한다", async () => {
    const seeded = seedListing({ status: "LISTED", listingRevision: 3 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        unlistPlanFromExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(1),
        }),
        { session: registeredSession(authorUser), state, nowIso: "2026-08-27T00:00:00.000Z" }
      ))).toBeInstanceOf(RevisionConflictError);
  });
});

describe("RAON-259 relistPlanInExplore", () => {
  it("author가 UNLISTED를 LISTED로 되살리고 새 snapshot·revision+1·listedAt=updatedAt=now·unlistedAt 제거", async () => {
    const seeded = seedListing({
      status: "UNLISTED",
      listingRevision: 2,
      listedAt: "2026-08-25T00:00:00.000Z",
      unlistedAt: "2026-08-26T00:00:00.000Z",
      snapshotRevision: 3,
      themeIds: ["culture"],
    });
    const state = makeState([seeded]);
    // source plan revision을 7로 올려 relist가 최신 projection을 반영하는지 검증.
    const roomWithNewerPlan: TripRoom = {
      ...sampleRoom,
      plans: [{ ...authorPlan, revision: RevisionSchema.make(7) }, hostPlan],
    };

    const listing = await runWith(
      relistPlanInExplore({
        listingId: seeded.listing.listingId,
        expectedRevision: RevisionSchema.make(2),
      }),
      {
        session: registeredSession(authorUser),
        state,
        rooms: [roomWithNewerPlan],
        nowIso: "2026-08-28T00:00:00.000Z",
      }
    );

    expect(listing.status).toBe("LISTED");
    expect(listing.listingRevision).toBe(3);
    expect(listing.listedAt).toBe("2026-08-28T00:00:00.000Z");
    expect(listing.updatedAt).toBe("2026-08-28T00:00:00.000Z");
    expect(listing.unlistedAt).toBeUndefined();
    // 새 server projection: 최신 source revision(7)로 교체하되 생략한 분류는 보존한다.
    expect(listing.snapshot.sourcePlanRevision).toBe(7);
    expect(listing.snapshot.themeIds).toEqual(["culture"]);
    expect(state.cas[0]).toEqual({ id: seeded.listing.listingId, expected: 2 });
  });

  it("LISTED 상태에서 relist하면 StateConflict로 거부한다", async () => {
    const seeded = seedListing({ status: "LISTED", listingRevision: 1 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        relistPlanInExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(1),
        }),
        { session: registeredSession(authorUser), state }
      ))).toBeInstanceOf(StateConflictError);
  });

  it("이미 LISTED여도 expectedRevision이 stale이면 RevisionConflict를 먼저 반환한다", async () => {
    const seeded = seedListing({ status: "LISTED", listingRevision: 4 });
    const state = makeState([seeded]);

    expect(await runAndCatch(runWith(
        relistPlanInExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(3),
        }),
        { session: registeredSession(authorUser), state }
      ))).toBeInstanceOf(RevisionConflictError);
    expect(state.cas).toEqual([]);
  });

  it("listing author가 아니면 ForbiddenError로 거부한다", async () => {
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 2 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        relistPlanInExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(2),
        }),
        { session: registeredSession(hostUser), state }
      ))).toBeInstanceOf(ForbiddenError);
  });

  it("source room이 사라졌으면 fail-closed(NotFound)로 거부한다", async () => {
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 2 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        relistPlanInExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(2),
        }),
        { session: registeredSession(authorUser), state, rooms: [] }
      ))).toBeInstanceOf(NotFoundError);
  });

  it("relist author가 더 이상 source plan 작성자가 아니면 ForbiddenError로 fail-closed", async () => {
    // listing author는 authorUser지만 source plan의 authorId가 host로 바뀐 경우
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 2 });
    const state = makeState([seeded]);
    const roomReassigned: TripRoom = {
      ...sampleRoom,
      plans: [
        { ...authorPlan, authorId: hostUser.id, authorName: hostUser.name },
        hostPlan,
      ],
    };
    expect(await runAndCatch(runWith(
        relistPlanInExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(2),
        }),
        { session: registeredSession(authorUser), state, rooms: [roomReassigned] }
      ))).toBeInstanceOf(ForbiddenError);
  });

  it("stale expectedRevision이면 repository CAS가 RevisionConflict로 실패한다", async () => {
    const seeded = seedListing({ status: "UNLISTED", listingRevision: 4 });
    const state = makeState([seeded]);
    expect(await runAndCatch(runWith(
        relistPlanInExplore({
          listingId: seeded.listing.listingId,
          expectedRevision: RevisionSchema.make(2),
        }),
        { session: registeredSession(authorUser), state, nowIso: "2026-08-28T00:00:00.000Z" }
      ))).toBeInstanceOf(RevisionConflictError);
  });
});


describe("RAON-271 classifyExploreListing", () => {
  it("author가 ID-only 분류를 canonical order로 수정하고 listing revision CAS를 유지한다", async () => {
    const seeded = seedListing({
      status: "LISTED",
      listingRevision: 4,
      listedAt: "2026-08-25T00:00:00.000Z",
      themeIds: ["culture"],
    });
    const state = makeState([seeded]);

    const listing = await runWith(
      classifyExploreListing({
        listingId: seeded.listing.listingId,
        expectedRevision: RevisionSchema.make(4),
        themeIds: ["nature", "food"],
      }),
      {
        session: registeredSession(authorUser),
        state,
        nowIso: "2026-08-29T00:00:00.000Z",
      }
    );

    expect(listing.snapshot.themeIds).toEqual(["food", "nature"]);
    expect(listing.snapshot.sourcePlanRevision).toBe(
      seeded.listing.snapshot.sourcePlanRevision
    );
    expect(listing.listedAt).toBe(seeded.listing.listedAt);
    expect(listing.updatedAt).toBe("2026-08-29T00:00:00.000Z");
    expect(listing.listingRevision).toBe(5);
    expect(state.cas[0]).toEqual({ id: seeded.listing.listingId, expected: 4 });
  });

  it("동일 분류 no-op도 load 이후 concurrent revision 변경을 CAS conflict로 감지한다", async () => {
    const seeded = seedListing({ listingRevision: 1, themeIds: ["culture"] });
    const state = makeState([seeded]);
    state.afterGet = () => {
      state.records.set(seeded.listing.listingId, {
        ...seeded,
        listing: {
          ...seeded.listing,
          listingRevision: RevisionSchema.make(2),
          snapshot: {
            ...seeded.listing.snapshot,
            themeIds: ["nature"],
          },
        },
      });
    };

    expect(
      await runAndCatch(
        runWith(
          classifyExploreListing({
            listingId: seeded.listing.listingId,
            expectedRevision: RevisionSchema.make(1),
            themeIds: ["culture"],
          }),
          { session: registeredSession(authorUser), state }
        )
      )
    ).toBeInstanceOf(RevisionConflictError);
    expect(state.cas).toEqual([{ id: seeded.listing.listingId, expected: 1 }]);
  });

  it("listing author가 아니면 분류를 수정할 수 없다", async () => {
    const seeded = seedListing({ themeIds: ["culture"] });
    const state = makeState([seeded]);

    expect(
      await runAndCatch(
        runWith(
          classifyExploreListing({
            listingId: seeded.listing.listingId,
            expectedRevision: RevisionSchema.make(1),
            themeIds: ["food"],
          }),
          { session: registeredSession(hostUser), state }
        )
      )
    ).toBeInstanceOf(ForbiddenError);
    expect(state.cas).toEqual([]);
  });

  it("stale expectedRevision은 분류 해석 전에 RevisionConflict로 거부한다", async () => {
    const seeded = seedListing({ listingRevision: 3, themeIds: ["culture"] });
    const state = makeState([seeded]);

    expect(
      await runAndCatch(
        runWith(
          classifyExploreListing({
            listingId: seeded.listing.listingId,
            expectedRevision: RevisionSchema.make(2),
            themeIds: ["food"],
          }),
          { session: registeredSession(authorUser), state }
        )
      )
    ).toBeInstanceOf(RevisionConflictError);
    expect(state.cas).toEqual([]);
  });
});
