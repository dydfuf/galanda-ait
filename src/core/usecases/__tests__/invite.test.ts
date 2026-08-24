import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { InvalidInviteError, UnauthorizedError } from "../../domain/errors.ts";
import {
  InviteTokenSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../domain/ids.ts";
import type { TripRoom, UserSession } from "../../domain/room.ts";
import type { IdGenerator } from "../../ports/id-generator.ts";
import {
  InviteRepository,
  type InviteRecord,
  type IssueInviteParams,
  type JoinInviteParams,
} from "../../ports/invite-repository.ts";
import { SessionService } from "../../ports/session.ts";
import { TripRoomRepository } from "../../ports/trip-room-repository.ts";
import { createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import {
  getPublicInviteSummary,
  issueTripInvite,
  joinTripByInvite,
  revokeTripInvite,
} from "../invite.ts";

const hostId = ParticipantIdSchema.make("host-1");
const memberId = ParticipantIdSchema.make("member-1");
const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "오사카 여행",
  destination: "오사카",
  revision: RevisionSchema.make(3),
  members: [
    { id: hostId, name: "Host", role: "HOST" },
    { id: memberId, name: "Member", role: "MEMBER" },
  ],
  plans: [
    {
      id: PlanIdSchema.make("plan-1"),
      title: "공개안",
      status: "CONFIRMED",
      authorId: hostId,
      routes: [
        {
          city: "오사카",
          arrivalDate: "2026-09-01",
          departureDate: "2026-09-04",
        },
      ],
      places: [{ id: "private-place", name: "비공개", category: "숙소", address: "비공개" }],
      memberOpinions: [
        { userId: memberId, userName: "Member", reaction: "HARD", reason: "비공개" },
      ],
      voteCount: 0,
    },
  ],
  confirmedPlanId: PlanIdSchema.make("plan-1"),
};

const session = (
  participantId: typeof hostId,
  isAuthenticated = true
): UserSession => ({
  participantId,
  participantIds: [participantId],
  accountType: "REGISTERED",
  name: participantId === hostId ? "Host" : "Member",
  isAuthenticated,
});

const sessionLayer = (value: UserSession): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, {
    getCurrentSession: () => Effect.succeed(value),
    getCurrentUser: () =>
      value.isAuthenticated
        ? Effect.succeed(value)
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
  });

const environment = (
  inviteLayer: Layer.Layer<InviteRepository>,
  currentSession: UserSession = session(hostId),
  idLayer: Layer.Layer<IdGenerator> = createTestIdGenerator(),
  currentRoom: TripRoom = room
) =>
  Layer.merge(
    Layer.merge(
      Layer.succeed(TripRoomRepository, {
        getRoom: () => Effect.succeed(currentRoom),
      } as unknown as TripRoomRepository["Service"]),
      inviteLayer
    ),
    Layer.merge(sessionLayer(currentSession), idLayer)
  );

describe("invite use cases", () => {
  it("방장이 7일짜리 opaque token을 발급하고 폐기를 멱등 호출한다", async () => {
    let issued: IssueInviteParams | undefined;
    let revokeCount = 0;
    const inviteLayer = Layer.succeed(InviteRepository, {
      issue: (params) => {
        issued = params;
        return Effect.void;
      },
      findValid: () => Effect.succeed(undefined),
      join: () => Effect.die("not used"),
      revoke: () => Effect.sync(() => { revokeCount += 1; }),
    });
    const fixedToken = "00000000-0000-4000-8000-000000000001";
    const before = Date.now();

    const result = await Effect.runPromise(
      issueTripInvite(room.id).pipe(
        Effect.provide(
          environment(
            inviteLayer,
            session(hostId),
            createTestIdGenerator({ inviteToken: fixedToken })
          )
        )
      )
    );
    await Effect.runPromise(
      revokeTripInvite(room.id).pipe(
        Effect.andThen(revokeTripInvite(room.id)),
        Effect.provide(environment(inviteLayer))
      )
    );

    expect(result.token).toBe(fixedToken);
    expect(issued).toMatchObject({
      token: fixedToken,
      tripId: room.id,
      issuedByParticipantId: hostId,
      inviterName: "Host",
    });
    expect(Date.parse(result.expiresAt) - before).toBeGreaterThan(6.99 * 86_400_000);
    expect(Date.parse(result.expiresAt) - before).toBeLessThan(7.01 * 86_400_000);
    expect(revokeCount).toBe(2);
  });

  it("일반 멤버의 발급을 거부한다", async () => {
    const inviteLayer = Layer.succeed(InviteRepository, {
      issue: () => Effect.die("must not issue"),
      findValid: () => Effect.succeed(undefined),
      join: () => Effect.die("not used"),
      revoke: () => Effect.void,
    });

    const exit = await Effect.runPromiseExit(
      issueTripInvite(room.id).pipe(
        Effect.provide(environment(inviteLayer, session(memberId)))
      )
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("ForbiddenError");
    }
  });

  it("로그인 전에는 공개 allowlist만, 참여자에게는 alreadyJoined만 추가한다", async () => {
    const record: InviteRecord = {
      tripId: room.id,
      inviterName: "Host",
    };
    const inviteLayer = Layer.succeed(InviteRepository, {
      issue: () => Effect.die("not used"),
      findValid: () => Effect.succeed(record),
      join: () => Effect.die("not used"),
      revoke: () => Effect.void,
    });
    const token = InviteTokenSchema.make("00000000-0000-4000-8000-000000000001");

    const anonymous = await Effect.runPromise(
      getPublicInviteSummary(token).pipe(
        Effect.provide(
          environment(inviteLayer, session(memberId, false))
        )
      )
    );
    const joined = await Effect.runPromise(
      getPublicInviteSummary(token).pipe(
        Effect.provide(environment(inviteLayer, session(memberId)))
      )
    );
    const unconfirmed = await Effect.runPromise(
      getPublicInviteSummary(token).pipe(
        Effect.provide(
          environment(
            inviteLayer,
            session(memberId, false),
            createTestIdGenerator(),
            { ...room, plans: [], confirmedPlanId: undefined }
          )
        )
      )
    );

    expect(anonymous).toEqual({
      title: "오사카 여행",
      inviterName: "Host",
      participantCount: 2,
      destination: "오사카",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      alreadyJoined: false,
    });
    expect(joined).toEqual({ ...anonymous, alreadyJoined: true });
    expect(unconfirmed).toEqual({
      title: "오사카 여행",
      inviterName: "Host",
      participantCount: 2,
      alreadyJoined: false,
    });
    expect(anonymous).not.toHaveProperty("tripId");
    expect(anonymous).not.toHaveProperty("members");
    expect(anonymous).not.toHaveProperty("plans");
  });

  it("malformed와 만료·폐기·미존재 token을 같은 오류로 숨긴다", async () => {
    let lookups = 0;
    const inviteLayer = Layer.succeed(InviteRepository, {
      issue: () => Effect.die("not used"),
      findValid: () => Effect.sync(() => { lookups += 1; return undefined; }),
      join: () => Effect.die("not used"),
      revoke: () => Effect.void,
    });
    const malformed = "invite-trip-1";
    const missing = "00000000-0000-4000-8000-000000000002";

    for (const token of [malformed, missing]) {
      const exit = await Effect.runPromiseExit(
        getPublicInviteSummary(token).pipe(
          Effect.provide(environment(inviteLayer, session(memberId, false)))
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = JSON.stringify(exit.cause);
        expect(failure).toContain("InvalidInviteError");
        expect(failure).not.toContain(token);
      }
    }
    expect(lookups).toBe(1);
    expect(new InvalidInviteError()).toMatchObject({ _tag: "InvalidInviteError" });
  });

  it("token과 세션 신원으로 닉네임 membership을 만들고 입력 신원 위조를 허용하지 않는다", async () => {
    const guestId = ParticipantIdSchema.make("guest-1");
    let joined: JoinInviteParams | undefined;
    const joinedRoom: TripRoom = {
      ...room,
      members: [
        ...room.members,
        { id: guestId, name: "Member", role: "MEMBER" },
      ],
    };
    const inviteLayer = Layer.succeed(InviteRepository, {
      issue: () => Effect.die("not used"),
      findValid: () => Effect.die("not used"),
      join: (params) => {
        joined = params;
        return Effect.succeed(joinedRoom);
      },
      revoke: () => Effect.die("not used"),
    });
    const token = "00000000-0000-4000-8000-000000000003";
    const guestSession: UserSession = {
      participantId: guestId,
      participantIds: [guestId],
      accountType: "GUEST",
      name: "Anonymous",
      isAuthenticated: true,
    };

    const result = await Effect.runPromise(
      joinTripByInvite(token, "  Member  ").pipe(
        Effect.provide(environment(inviteLayer, guestSession))
      )
    );

    expect(result).toEqual(joinedRoom);
    expect(joined).toMatchObject({
      token,
      member: { id: guestId, name: "Member", role: "MEMBER" },
      participantIds: [guestId],
    });
  });

  it("잘못된 token과 공백·과도하게 긴 닉네임은 저장소 호출 전에 거부한다", async () => {
    let joins = 0;
    const inviteLayer = Layer.succeed(InviteRepository, {
      issue: () => Effect.die("not used"),
      findValid: () => Effect.die("not used"),
      join: () => Effect.sync(() => { joins += 1; return undefined; }),
      revoke: () => Effect.die("not used"),
    });

    for (const [token, nickname] of [
      ["invite-trip-1", "Guest"],
      ["00000000-0000-4000-8000-000000000004", "   "],
      ["00000000-0000-4000-8000-000000000004", "가".repeat(21)],
    ]) {
      const exit = await Effect.runPromiseExit(
        joinTripByInvite(token, nickname).pipe(
          Effect.provide(environment(inviteLayer))
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }
    expect(joins).toBe(0);
  });
});
