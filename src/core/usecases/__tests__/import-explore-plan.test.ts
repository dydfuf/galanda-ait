import { describe, expect, it } from "vitest";
import { Clock, Effect, Layer } from "effect";
import {
  ExploreListingIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
  type Revision,
  type TripId,
} from "../../domain/ids.ts";
import type {
  TripMember,
  TripPlan,
  TripRoom,
  UserSession,
} from "../../domain/room.ts";
import type { ExplorePlanSnapshot } from "../../domain/explore-plan.ts";
import { SessionService } from "../../ports/session.ts";
import {
  TripRoomRepository,
  type CreateRoomParams,
} from "../../ports/trip-room-repository.ts";
import {
  ExplorePlanRepository,
  type ExplorePlanListingRecord,
} from "../../ports/explore-plan-repository.ts";
import {
  AccountUpgradeRequiredError,
  ExploreListingUnavailableError,
  ForbiddenError,
  NotFoundError,
  RevisionConflictError,
  StateConflictError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/errors.ts";
import { createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import { importExplorePlan } from "../import-explore-plan.ts";

// --- fixtures ---------------------------------------------------------------

const hostUser: TripMember = {
  id: UserIdSchema.make("user-host"),
  name: "방장",
  role: "HOST",
};
const memberUser: TripMember = {
  id: UserIdSchema.make("user-member"),
  name: "멤버",
  role: "MEMBER",
};
const outsiderId = UserIdSchema.make("user-outsider");

const snapshot: ExplorePlanSnapshot = {
  title: "오사카 3박 4일",
  destination: "오사카",
  routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
  stays: [
    { city: "오사카", hotelName: undefined, isSearching: true, nights: 3 },
  ],
  transports: [
    { fromCity: "서울", toCity: "오사카", mode: "항공", hasTransfer: false, durationText: "1시간 40분" },
    { fromCity: "오사카", toCity: "서울", mode: "항공", hasTransfer: false, durationText: "1시간 40분" },
  ],
  author: { displayName: "원작성자" },
  sourcePlanRevision: RevisionSchema.make(3),
};

const targetRoom: TripRoom = {
  id: TripIdSchema.make("room-existing"),
  title: "기존 여행방",
  destination: "기존목적지",
  revision: RevisionSchema.make(5),
  members: [hostUser, memberUser],
  plans: [],
  confirmedPlanId: undefined,
};

const listingRecord = (over?: {
  status?: "LISTED" | "UNLISTED";
}): ExplorePlanListingRecord => ({
  listing: {
    listingId: ExploreListingIdSchema.make("listing-1"),
    status: over?.status ?? "LISTED",
    listingRevision: RevisionSchema.make(1),
    listedAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    snapshot,
  },
  sourceTripId: TripIdSchema.make("source-trip-secret"),
  sourcePlanId: PlanIdSchema.make("source-plan-secret"),
  sourceAuthorParticipantId: UserIdSchema.make("source-author-secret"),
});

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

interface FakeTripState {
  readonly created: CreateRoomParams[];
  readonly saved: Array<{ room: TripRoom; expected: Revision }>;
  readonly getRoomCalls: TripId[];
}

const makeTripState = (): FakeTripState => ({
  created: [],
  saved: [],
  getRoomCalls: [],
});

const tripRepoLayer = (
  rooms: ReadonlyArray<TripRoom>,
  state: FakeTripState
): Layer.Layer<TripRoomRepository> =>
  Layer.succeed(TripRoomRepository, {
    getRoom: (roomId: TripId) => {
      state.getRoomCalls.push(roomId);
      const found = rooms.find((r) => r.id === roomId);
      return found
        ? Effect.succeed(found)
        : Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
    },
    getRooms: () => Effect.succeed(rooms),
    createRoom: (params) => {
      state.created.push(params);
      return Effect.succeed({
        id: params.id,
        title: params.title,
        destination: params.destination ?? "여행지",
        revision: RevisionSchema.make(1),
        members: [params.hostUser],
        plans: params.initialPlan ? [params.initialPlan] : [],
        confirmedPlanId: undefined,
      });
    },
    updateRoom: () => Effect.die("not implemented"),
    createPlan: () => Effect.die("not implemented"),
    updatePlan: () => Effect.die("not implemented"),
    saveRoom: (room, expected) => {
      const current = rooms.find((r) => r.id === room.id);
      if (!current) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: room.id }));
      }
      if (current.revision !== expected) {
        return Effect.fail(
          new RevisionConflictError({
            message: "conflict",
            expectedRevision: expected,
            actualRevision: current.revision,
          })
        );
      }
      state.saved.push({ room, expected });
      return Effect.succeed({
        ...room,
        revision: RevisionSchema.make(expected + 1),
      });
    },
    deletePlanAndAutoUnlist: () => Effect.die("not implemented"),
  });

const exploreRepoLayer = (
  record: ExplorePlanListingRecord | undefined,
  state?: { getByIdCalls: string[] }
): Layer.Layer<ExplorePlanRepository> =>
  Layer.succeed(ExplorePlanRepository, {
    create: () => Effect.die("not implemented"),
    getById: (listingId) => {
      state?.getByIdCalls.push(listingId);
      return Effect.succeed(record);
    },
    getPublicById: () => Effect.die("not implemented"),
    findBySource: () => Effect.succeed(undefined),
    relist: () => Effect.die("not implemented"),
    compareAndSet: () => Effect.die("not implemented"),
    listListed: () =>
      Effect.succeed({
        page: [],
        nextCursor: undefined,
        rankingMode: "RECENCY_FALLBACK" as const,
      }),
    listPopularCities: () => Effect.succeed([]),
  });

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
    record?: ExplorePlanListingRecord;
    noListing?: boolean;
    tripState?: FakeTripState;
    exploreState?: { getByIdCalls: string[] };
    tripId?: string;
    planId?: string;
    nowIso?: string;
  }
): Promise<A> => {
  const tripState = opts.tripState ?? makeTripState();
  const base = Layer.mergeAll(
    sessionLayer(opts.session),
    tripRepoLayer(opts.rooms ?? [targetRoom], tripState),
    exploreRepoLayer(
      opts.noListing ? undefined : opts.record ?? listingRecord(),
      opts.exploreState
    ),
    createTestIdGenerator({ tripId: opts.tripId, planId: opts.planId })
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

// --- NEW_TRIP ---------------------------------------------------------------

describe("RAON-261 importExplorePlan NEW_TRIP", () => {
  it("등록 세션이 room+plan을 단일 createRoom(initialPlan)로 저장하고 {tripId, planId}만 반환한다", async () => {
    const tripState = makeTripState();
    const result = await runWith(
      importExplorePlan({
        listingId: ExploreListingIdSchema.make("listing-1"),
        target: { type: "NEW_TRIP" },
      }),
      {
        session: registeredSession(memberUser),
        tripState,
        tripId: "new-trip-1",
        planId: "new-plan-1",
        nowIso: "2026-08-30T09:00:00.000Z",
      }
    );

    expect(result).toEqual({ tripId: "new-trip-1", planId: "new-plan-1" });
    // 단일 write: createRoom 1회, initialPlan 포함, saveRoom 미사용.
    expect(tripState.created).toHaveLength(1);
    expect(tripState.saved).toHaveLength(0);
    const created = tripState.created[0]!;
    expect(created.initialPlan).toBeDefined();
    expect(created.initialPlan!.id).toBe("new-plan-1");
    expect(created.initialPlan!.status).toBe("VOTING");
    expect(created.initialPlan!.revision).toBe(1);
    expect(created.initialPlan!.authorId).toBe(memberUser.id);
    expect(created.initialPlan!.baseHeadcount).toBe(1);
    expect(created.initialPlan!.importedFromExploreListingId).toBe("listing-1");
    // NEW_TRIP은 destination=snapshot.destination, 기본 title=snapshot.title.
    expect(created.destination).toBe("오사카");
    expect(created.title).toBe("오사카 3박 4일");
    // 어떤 source room lookup도 하지 않는다.
    expect(tripState.getRoomCalls).toEqual([]);
  });

  it("사용자가 준 title(trim)을 room title로 쓴다", async () => {
    const tripState = makeTripState();
    await runWith(
      importExplorePlan({
        listingId: ExploreListingIdSchema.make("listing-1"),
        target: { type: "NEW_TRIP", title: "  내 오사카 여행  " },
      }),
      { session: registeredSession(memberUser), tripState, nowIso: "2026-08-30T09:00:00.000Z" }
    );
    expect(tripState.created[0]!.title).toBe("내 오사카 여행");
  });

  it("명시적으로 빈 title을 보내면 ValidationError로 거부한다", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: { type: "NEW_TRIP", title: "   " },
          }),
          { session: registeredSession(memberUser) }
        )
      )
    ).toBeInstanceOf(ValidationError);
  });

  it("미인증 세션은 UnauthorizedError로 거부한다", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: { type: "NEW_TRIP" },
          }),
          { session: unauthenticatedSession }
        )
      )
    ).toBeInstanceOf(UnauthorizedError);
  });

  it("GUEST 계정은 AccountUpgradeRequiredError로 거부한다(createTripRoom과 동일 semantics)", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: { type: "NEW_TRIP" },
          }),
          { session: guestSession }
        )
      )
    ).toBeInstanceOf(AccountUpgradeRequiredError);
  });
});

// --- EXISTING_TRIP ----------------------------------------------------------

describe("RAON-261 importExplorePlan EXISTING_TRIP", () => {
  it("멤버가 미확정 방에 CAS로 plan을 추가하고 title/destination을 덮어쓰지 않는다", async () => {
    const tripState = makeTripState();
    const result = await runWith(
      importExplorePlan({
        listingId: ExploreListingIdSchema.make("listing-1"),
        target: {
          type: "EXISTING_TRIP",
          tripId: targetRoom.id,
          expectedRevision: RevisionSchema.make(5),
        },
      }),
      {
        session: registeredSession(memberUser),
        tripState,
        planId: "added-plan-1",
        nowIso: "2026-08-30T09:00:00.000Z",
      }
    );

    expect(result).toEqual({ tripId: targetRoom.id, planId: "added-plan-1" });
    expect(tripState.created).toHaveLength(0);
    expect(tripState.saved).toHaveLength(1);
    const { room, expected } = tripState.saved[0]!;
    expect(expected).toBe(5); // CAS는 expectedRevision을 사용한다.
    // 기존 title/destination 유지.
    expect(room.title).toBe("기존 여행방");
    expect(room.destination).toBe("기존목적지");
    // plan만 추가.
    expect(room.plans).toHaveLength(1);
    const added = room.plans[0]!;
    expect(added.id).toBe("added-plan-1");
    expect(added.status).toBe("VOTING");
    expect(added.revision).toBe(1);
    expect(added.authorId).toBe(memberUser.id);
    // baseHeadcount = Math.max(1, room.members.length) = 2.
    expect(added.baseHeadcount).toBe(2);
    expect(added.importedFromExploreListingId).toBe("listing-1");
  });

  it("stale expectedRevision은 authorization 이후 RevisionConflict로 거부한다(state 해석 전)", async () => {
    const tripState = makeTripState();
    const error = await runAndCatch(
      runWith(
        importExplorePlan({
          listingId: ExploreListingIdSchema.make("listing-1"),
          target: {
            type: "EXISTING_TRIP",
            tripId: targetRoom.id,
            expectedRevision: RevisionSchema.make(4),
          },
        }),
        { session: registeredSession(memberUser), tripState }
      )
    );
    expect(error).toBeInstanceOf(RevisionConflictError);
    // CAS까지 가지 않고 loaded-revision mismatch에서 먼저 실패한다.
    expect(tripState.saved).toHaveLength(0);
  });

  it("비멤버(outsider)는 plan:create 권한이 없어 ForbiddenError로 거부한다", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: {
              type: "EXISTING_TRIP",
              tripId: targetRoom.id,
              expectedRevision: RevisionSchema.make(5),
            },
          }),
          { session: outsiderSession }
        )
      )
    ).toBeInstanceOf(ForbiddenError);
  });

  it("존재하지 않는 대상 방은 NotFound로 거부한다", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: {
              type: "EXISTING_TRIP",
              tripId: TripIdSchema.make("room-missing"),
              expectedRevision: RevisionSchema.make(1),
            },
          }),
          { session: registeredSession(memberUser), rooms: [] }
        )
      )
    ).toBeInstanceOf(NotFoundError);
  });

  it("확정된 방에는 StateConflict로 거부한다", async () => {
    const confirmedRoom: TripRoom = {
      ...targetRoom,
      confirmedPlanId: PlanIdSchema.make("confirmed-plan"),
      plans: [
        {
          id: PlanIdSchema.make("confirmed-plan"),
          title: "확정안",
          status: "CONFIRMED",
          revision: RevisionSchema.make(1),
          places: [],
          voteCount: 0,
        } as TripPlan,
      ],
    };
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: {
              type: "EXISTING_TRIP",
              tripId: targetRoom.id,
              expectedRevision: RevisionSchema.make(5),
            },
          }),
          { session: registeredSession(memberUser), rooms: [confirmedRoom] }
        )
      )
    ).toBeInstanceOf(StateConflictError);
  });

  it("미인증 세션은 UnauthorizedError로 거부한다", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: {
              type: "EXISTING_TRIP",
              tripId: targetRoom.id,
              expectedRevision: RevisionSchema.make(5),
            },
          }),
          { session: unauthenticatedSession }
        )
      )
    ).toBeInstanceOf(UnauthorizedError);
  });
});

// --- listing state guards (shared) ------------------------------------------

describe("RAON-261 importExplorePlan listing state guards", () => {
  it("존재하지 않는 listing은 NotFound(ExplorePlanListing)로 거부한다", async () => {
    const error = await runAndCatch(
      runWith(
        importExplorePlan({
          listingId: ExploreListingIdSchema.make("listing-missing"),
          target: { type: "NEW_TRIP" },
        }),
        { session: registeredSession(memberUser), noListing: true }
      )
    );
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).entity).toBe("ExplorePlanListing");
  });

  it("UNLISTED listing은 ExploreListingUnavailable(410)로 거부한다", async () => {
    expect(
      await runAndCatch(
        runWith(
          importExplorePlan({
            listingId: ExploreListingIdSchema.make("listing-1"),
            target: { type: "NEW_TRIP" },
          }),
          {
            session: registeredSession(memberUser),
            record: listingRecord({ status: "UNLISTED" }),
          }
        )
      )
    ).toBeInstanceOf(ExploreListingUnavailableError);
  });
});

// --- auth-first ordering (DISC-7 correction) --------------------------------

describe("RAON-261 importExplorePlan authenticates before reading listing", () => {
  it("NEW_TRIP 미인증: listing getById도 room read/write도 하지 않고 UnauthorizedError", async () => {
    const exploreState = { getByIdCalls: [] as string[] };
    const tripState = makeTripState();
    const error = await runAndCatch(
      runWith(
        importExplorePlan({
          listingId: ExploreListingIdSchema.make("listing-1"),
          target: { type: "NEW_TRIP" },
        }),
        { session: unauthenticatedSession, exploreState, tripState }
      )
    );
    expect(error).toBeInstanceOf(UnauthorizedError);
    // 인증 실패는 Explore/Trip repository read를 전혀 하지 않는다(존재 여부 probing 불가).
    expect(exploreState.getByIdCalls).toEqual([]);
    expect(tripState.getRoomCalls).toEqual([]);
    expect(tripState.created).toEqual([]);
    expect(tripState.saved).toEqual([]);
  });

  it("EXISTING_TRIP 미인증: listing getById도 room read/write도 하지 않고 UnauthorizedError", async () => {
    const exploreState = { getByIdCalls: [] as string[] };
    const tripState = makeTripState();
    const error = await runAndCatch(
      runWith(
        importExplorePlan({
          listingId: ExploreListingIdSchema.make("listing-1"),
          target: {
            type: "EXISTING_TRIP",
            tripId: targetRoom.id,
            expectedRevision: RevisionSchema.make(5),
          },
        }),
        { session: unauthenticatedSession, exploreState, tripState }
      )
    );
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(exploreState.getByIdCalls).toEqual([]);
    expect(tripState.getRoomCalls).toEqual([]);
    expect(tripState.created).toEqual([]);
    expect(tripState.saved).toEqual([]);
  });

  it("NEW_TRIP GUEST: account-upgrade가 listing lookup보다 먼저 실행되어 getById를 하지 않는다", async () => {
    const exploreState = { getByIdCalls: [] as string[] };
    const tripState = makeTripState();
    const error = await runAndCatch(
      runWith(
        importExplorePlan({
          listingId: ExploreListingIdSchema.make("listing-1"),
          target: { type: "NEW_TRIP" },
        }),
        { session: guestSession, exploreState, tripState }
      )
    );
    expect(error).toBeInstanceOf(AccountUpgradeRequiredError);
    // 계정 업그레이드 요구는 listing lookup 이전에 발생한다.
    expect(exploreState.getByIdCalls).toEqual([]);
    expect(tripState.getRoomCalls).toEqual([]);
    expect(tripState.created).toEqual([]);
    expect(tripState.saved).toEqual([]);
  });

  it("인증에 성공하면 listing을 한 번 읽는다(대조군)", async () => {
    const exploreState = { getByIdCalls: [] as string[] };
    await runWith(
      importExplorePlan({
        listingId: ExploreListingIdSchema.make("listing-1"),
        target: { type: "NEW_TRIP" },
      }),
      {
        session: registeredSession(memberUser),
        exploreState,
        nowIso: "2026-08-30T09:00:00.000Z",
      }
    );
    expect(exploreState.getByIdCalls).toEqual(["listing-1"]);
  });
});
