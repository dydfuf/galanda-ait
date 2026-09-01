import { describe, expect, it } from "vitest";
import { Clock, Effect, Layer } from "effect";
import {
  ExploreListingIdSchema,
  ParticipantIdSchema,
  RevisionSchema,
} from "../../domain/ids.ts";
import type { UserSession } from "../../domain/room.ts";
import type { ExplorePlanListing } from "../../domain/explore-plan.ts";
import { SessionService } from "../../ports/session.ts";
import {
  ExplorePlanRepository,
  type ExplorePlanListingRecord,
} from "../../ports/explore-plan-repository.ts";
import {
  ExploreSaveRepository,
  type ListSavedListingsResult,
  type SavedListingEntry,
} from "../../ports/explore-save-repository.ts";
import {
  ExploreListingUnavailableError,
  NotFoundError,
  UnauthorizedError,
} from "../../domain/errors.ts";
import { createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import type { IdGenerator } from "../../ports/id-generator.ts";
import {
  getExploreSaveState,
  listSavedExploreListings,
  saveExploreListing,
  unsaveExploreListing,
} from "../explore-save.ts";

// --- fixtures ---------------------------------------------------------------

const listingId = ExploreListingIdSchema.make("listing-1");

const snapshot = {
  title: "교토 3박 4일",
  destination: "일본 간사이",
  routes: [
    { city: "교토", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
  ],
  dateRange: { startDate: "2026-10-01", endDate: "2026-10-04", nightCount: 3 },
  stays: [],
  transports: [],
  author: { displayName: "여행자" },
  sourcePlanRevision: RevisionSchema.make(1),
};

const listingRecord = (
  status: "LISTED" | "UNLISTED" = "LISTED"
): ExplorePlanListingRecord => ({
  listing: {
    listingId,
    status,
    listingRevision: RevisionSchema.make(1),
    listedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    unlistedAt: status === "UNLISTED" ? "2026-09-02T00:00:00.000Z" : undefined,
    snapshot,
  } satisfies ExplorePlanListing,
  sourceTripId: "trip-1" as ExplorePlanListingRecord["sourceTripId"],
  sourcePlanId: "plan-1" as ExplorePlanListingRecord["sourcePlanId"],
  sourceAuthorParticipantId:
    "author-1" as ExplorePlanListingRecord["sourceAuthorParticipantId"],
});

const session = (
  participantId: string,
  participantIds: string[] = [participantId],
  accountType: "GUEST" | "REGISTERED" = "REGISTERED"
): UserSession => ({
  participantId: ParticipantIdSchema.make(participantId),
  participantIds: participantIds.map((id) => ParticipantIdSchema.make(id)),
  accountType,
  name: "사용자",
  isAuthenticated: true,
});

const anonymousSession: UserSession = {
  participantId: ParticipantIdSchema.make("anon"),
  participantIds: [ParticipantIdSchema.make("anon")],
  accountType: "GUEST",
  name: "비로그인",
  isAuthenticated: false,
};

// --- fakes ------------------------------------------------------------------

const sessionLayer = (s: UserSession): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, {
    getCurrentSession: () => Effect.succeed(s),
    getCurrentUser: () =>
      s.isAuthenticated
        ? Effect.succeed(s)
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
  });

const listingRepoLayer = (
  record: ExplorePlanListingRecord | undefined
): Layer.Layer<ExplorePlanRepository> =>
  Layer.succeed(ExplorePlanRepository, {
    create: () => Effect.die("not implemented"),
    getById: () => Effect.succeed(record),
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

interface FakeSaveState {
  /** key: `${participantId}::${listingId}` */
  readonly rows: Set<string>;
  readonly savedCalls: Array<{ participantId: string; listingId: string }>;
  readonly unsaveCalls: Array<{ participantIds: string[]; listingId: string }>;
  savedList?: ListSavedListingsResult;
}

const saveRepoLayer = (
  state: FakeSaveState,
  listing?: ExplorePlanListingRecord
): Layer.Layer<ExploreSaveRepository> =>
  Layer.succeed(ExploreSaveRepository, {
    save: ({ participantId, participantIds, listingId: id }) => {
      if (!listing) {
        return Effect.fail(
          new NotFoundError({ entity: "ExplorePlanListing", id })
        );
      }
      if (listing.listing.status !== "LISTED") {
        return Effect.fail(new ExploreListingUnavailableError());
      }
      state.savedCalls.push({ participantId, listingId: id });
      // idempotent: alias 집합 중 하나라도 이미 있으면 새로 만들지 않는다.
      const already = participantIds.some((pid) =>
        state.rows.has(`${pid}::${id}`)
      );
      if (!already) state.rows.add(`${participantId}::${id}`);
      return Effect.succeed({ saved: true, saveCount: 0 } as const);
    },
    unsave: ({ participantIds, listingId: id }) => {
      state.unsaveCalls.push({
        participantIds: [...participantIds],
        listingId: id,
      });
      for (const pid of participantIds) state.rows.delete(`${pid}::${id}`);
      return Effect.succeed({ saved: false, saveCount: 0 } as const);
    },
    isSaved: ({ participantIds, listingId: id }) =>
      Effect.succeed({
        saved: participantIds.some((pid) => state.rows.has(`${pid}::${id}`)),
        saveCount: 0,
      }),
    listSaved: () =>
      Effect.succeed(
        state.savedList ?? { page: [], nextCursor: undefined }
      ),
  });

const makeSaveState = (rows: string[] = []): FakeSaveState => ({
  rows: new Set(rows),
  savedCalls: [],
  unsaveCalls: [],
});

const idLayer: Layer.Layer<IdGenerator> = createTestIdGenerator();

const fixedClock = (iso: string): Clock.Clock => {
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
    listing?: ExplorePlanListingRecord | undefined;
    state?: FakeSaveState;
    nowIso?: string;
  }
): Promise<A> => {
  const state = opts.state ?? makeSaveState();
  const base = Layer.mergeAll(
    sessionLayer(opts.session),
    listingRepoLayer(opts.listing),
    saveRepoLayer(state, opts.listing),
    idLayer
  );
  const provided = effect.pipe(Effect.provide(base));
  const program = opts.nowIso
    ? provided.pipe(Effect.provideService(Clock.Clock, fixedClock(opts.nowIso)))
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

// --- save -------------------------------------------------------------------

describe("saveExploreListing", () => {
  it("LISTED listing을 저장하고 canonical participant로 기록한다", async () => {
    const state = makeSaveState();
    const result = await runWith(saveExploreListing({ listingId }), {
      session: session("p-1"),
      listing: listingRecord("LISTED"),
      state,
      nowIso: "2026-09-03T00:00:00.000Z",
    });
    expect(result).toEqual({ saved: true, saveCount: 0 });
    expect(state.savedCalls[0]!.participantId).toBe("p-1");
    expect(state.rows.has("p-1::listing-1")).toBe(true);
  });

  it("이미 저장돼 있으면 idempotent하게 성공한다(중복 row 없음)", async () => {
    const state = makeSaveState(["p-1::listing-1"]);
    const result = await runWith(saveExploreListing({ listingId }), {
      session: session("p-1"),
      listing: listingRecord("LISTED"),
      state,
    });
    expect(result).toEqual({ saved: true, saveCount: 0 });
    expect(state.rows.size).toBe(1);
  });

  it("UNLISTED listing 저장은 410 ExploreListingUnavailable로 거부한다", async () => {
    const error = await runAndCatch(
      runWith(saveExploreListing({ listingId }), {
        session: session("p-1"),
        listing: listingRecord("UNLISTED"),
      })
    );
    expect(error).toBeInstanceOf(ExploreListingUnavailableError);
  });

  it("없는 listing 저장은 404 NotFound로 거부한다", async () => {
    const error = await runAndCatch(
      runWith(saveExploreListing({ listingId }), {
        session: session("p-1"),
        listing: undefined,
      })
    );
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("비로그인 세션은 저장할 수 없다(Unauthorized)", async () => {
    const error = await runAndCatch(
      runWith(saveExploreListing({ listingId }), {
        session: anonymousSession,
        listing: listingRecord("LISTED"),
      })
    );
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it("GUEST 세션도 저장할 수 있다(개인 북마크)", async () => {
    const state = makeSaveState();
    const result = await runWith(saveExploreListing({ listingId }), {
      session: session("guest-1", ["guest-1"], "GUEST"),
      listing: listingRecord("LISTED"),
      state,
    });
    expect(result).toEqual({ saved: true, saveCount: 0 });
  });

  it("identity promotion 후 alias가 저장한 listing은 재저장하지 않는다(중복 방지)", async () => {
    // 과거 guest(alias)로 저장 → promotion 후 canonical + alias 세션.
    const state = makeSaveState(["old-alias::listing-1"]);
    const result = await runWith(saveExploreListing({ listingId }), {
      session: session("new-canonical", ["new-canonical", "old-alias"]),
      listing: listingRecord("LISTED"),
      state,
    });
    expect(result).toEqual({ saved: true, saveCount: 0 });
    // 새 canonical row를 만들지 않는다(alias row가 이미 존재).
    expect(state.rows.has("new-canonical::listing-1")).toBe(false);
    expect(state.rows.size).toBe(1);
  });
});

// --- unsave -----------------------------------------------------------------

describe("unsaveExploreListing", () => {
  it("저장을 해제하고 alias 집합 전체에서 삭제한다", async () => {
    const state = makeSaveState(["p-1::listing-1", "p-alias::listing-1"]);
    const result = await runWith(unsaveExploreListing({ listingId }), {
      session: session("p-1", ["p-1", "p-alias"]),
      state,
    });
    expect(result).toEqual({ saved: false, saveCount: 0 });
    expect(state.rows.size).toBe(0);
  });

  it("저장돼 있지 않아도 반복 안전하게 성공한다(idempotent)", async () => {
    const state = makeSaveState();
    const result = await runWith(unsaveExploreListing({ listingId }), {
      session: session("p-1"),
      state,
    });
    expect(result).toEqual({ saved: false, saveCount: 0 });
  });

  it("listing 존재/상태를 검사하지 않는다(deleted/unlisted에도 unsave 성공)", async () => {
    // listing repo를 undefined로 두어도 unsave는 listing을 읽지 않는다.
    const state = makeSaveState(["p-1::listing-1"]);
    const result = await runWith(unsaveExploreListing({ listingId }), {
      session: session("p-1"),
      listing: undefined,
      state,
    });
    expect(result).toEqual({ saved: false, saveCount: 0 });
  });
});

// --- state / saved-list -----------------------------------------------------

describe("getExploreSaveState", () => {
  it("alias 집합 중 하나라도 저장했으면 saved=true", async () => {
    const state = makeSaveState(["p-alias::listing-1"]);
    const result = await runWith(getExploreSaveState({ listingId }), {
      session: session("p-1", ["p-1", "p-alias"]),
      state,
    });
    expect(result).toEqual({ saved: true, saveCount: 0 });
  });

  it("저장하지 않았으면 saved=false", async () => {
    const result = await runWith(getExploreSaveState({ listingId }), {
      session: session("p-1"),
      state: makeSaveState(),
    });
    expect(result).toEqual({ saved: false, saveCount: 0 });
  });
});

describe("listSavedExploreListings", () => {
  it("repository가 반환한 LISTED read-through 페이지를 그대로 반환한다", async () => {
    const entry: SavedListingEntry = {
      savedAt: "2026-09-02T00:00:00.000Z",
      listing: listingRecord("LISTED").listing,
      saveCount: 0,
    };
    const state = makeSaveState();
    state.savedList = { page: [entry], nextCursor: undefined };
    const result = await runWith(
      listSavedExploreListings({ limit: 20 }),
      { session: session("p-1"), state }
    );
    expect(result.page).toHaveLength(1);
    expect(result.page[0]!.listing.status).toBe("LISTED");
  });

  it("비로그인은 저장 목록을 볼 수 없다", async () => {
    const error = await runAndCatch(
      runWith(listSavedExploreListings({ limit: 20 }), {
        session: anonymousSession,
      })
    );
    expect(error).toBeInstanceOf(UnauthorizedError);
  });
});
