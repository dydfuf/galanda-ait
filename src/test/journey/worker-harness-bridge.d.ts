/**
 * Narrow typed surface for the test-only runtime bridge.
 * Concrete harness/fixture implementations are independently typechecked by
 * tsconfig.worker.json.
 */
export interface JourneyHarness {
  readonly app: {
    readonly fetch: (
      request: Request,
      env?: unknown
    ) => Response | Promise<Response>;
  };
  readonly requestAs: (
    participantId: string | null,
    path: string,
    init?: RequestInit
  ) => Promise<Response>;
}

export interface JourneyHarnessSeed {
  readonly participants: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly accountType?: "REGISTERED" | "GUEST";
    readonly aliases?: readonly string[];
  }>;
  readonly tripRooms?: readonly unknown[];
  readonly exploreListings?: readonly unknown[];
  readonly exploreSaves?: readonly unknown[];
}

export function createJourneyHarness(
  seed: JourneyHarnessSeed
): JourneyHarness;

export function routeFetchToApp(
  harness: JourneyHarness,
  participantId: string | null
): { readonly restore: () => void };

export function publishablePlan(options: {
  readonly planId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly revision?: number;
  readonly title?: string;
  readonly hardReason?: string;
  readonly opinionUserId?: string;
}): unknown;

export function privateRoom(options: {
  readonly tripId: string;
  readonly host: { readonly id: string; readonly name: string };
  readonly extraMembers?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly plans: ReadonlyArray<unknown>;
  readonly revision?: number;
  readonly createdAt?: string;
}): unknown;

export function listedListing(options: {
  readonly listingId: string;
  readonly sourceTripId: string;
  readonly sourcePlanId: string;
  readonly sourceAuthorParticipantId: string;
  readonly listedAt?: string;
  readonly title?: string;
}): unknown;
