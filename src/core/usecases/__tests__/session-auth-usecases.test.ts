import { describe, expect, it } from "vitest";
import { Effect, Layer, Option } from "effect";
import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "../../domain/ids.ts";
import type { TripMember, TripPlan, TripRoom, UserSession } from "../../domain/room.ts";
import { SessionService, requireAuthSession, getCurrentUser, getOptionalSession } from "../../ports/session.ts";
import { TripRoomRepository, type CreateRoomParams, type UpdateRoomParams } from "../../ports/trip-room-repository.ts";
import { createLocalSessionLayer, DEFAULT_LOCAL_USER, makeLocalSessionService } from "../../../infrastructure/local/local-session.ts";
import { createTripRoomUseCase, type CreateRoomInput } from "../create-room.ts";
import { joinTripRoomUseCase, type JoinRoomInput } from "../join-room.ts";
import { createPlanUseCase, updatePlanUseCase, deletePlanUseCase } from "../save-plan.ts";
import {
  submitPlanOpinionUseCase,
  type SubmitPlanOpinionInput,
} from "../submit-opinion.ts";
import { confirmTripPlan } from "../confirm-plan.ts";
import { updateTripRoomUseCase } from "../update-room.ts";
import {
  NotFoundError,
  ConflictError,
  SessionUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/errors.ts";

/**
 * 테스트용 인메모리 TripRoomRepository 구현체 생성 헬퍼
 */
const createInMemoryRepositoryLayer = (
  initialRooms: TripRoom[] = []
): Layer.Layer<TripRoomRepository> => {
  let rooms: TripRoom[] = [...initialRooms];

  const repoImpl = {
    getRoom: (
      roomId: typeof TripIdSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError> => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      return Effect.succeed(room);
    },
    getRooms: (): Effect.Effect<ReadonlyArray<TripRoom>, never> => Effect.succeed(rooms),
    createRoom: (
      params: CreateRoomParams
    ): Effect.Effect<TripRoom, never> => {
      const newRoom: TripRoom = {
        id: TripIdSchema.make(`room-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
        title: params.title,
        destination: params.destination ?? "목적지",
        startDate: params.startDate ?? "2026-09-01",
        endDate: params.endDate ?? "2026-09-05",
        revision: RevisionSchema.make(1),
        members: [params.hostUser],
        plans: [],
        confirmedPlanId: undefined,
      };
      rooms = [newRoom, ...rooms];
      return Effect.succeed(newRoom);
    },
    updateRoom: (
      roomId: typeof TripIdSchema.Type,
      params: UpdateRoomParams,
      expectedRevision: typeof RevisionSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return Effect.fail(
          new ConflictError({
            message: "Revision mismatch",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }
      const updated: TripRoom = {
        ...room,
        title: params.title ?? room.title,
        destination: params.destination ?? room.destination,
        startDate: params.startDate ?? room.startDate,
        endDate: params.endDate ?? room.endDate,
        revision: RevisionSchema.make(room.revision + 1),
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
    createPlan: (
      roomId: typeof TripIdSchema.Type,
      plan: TripPlan,
      expectedRevision: typeof RevisionSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return Effect.fail(
          new ConflictError({
            message: "Revision mismatch",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }
      const updated: TripRoom = {
        ...room,
        plans: [...room.plans, plan],
        revision: RevisionSchema.make(room.revision + 1),
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
    updatePlan: (
      roomId: typeof TripIdSchema.Type,
      plan: TripPlan,
      expectedRevision: typeof RevisionSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return Effect.fail(
          new ConflictError({
            message: "Revision mismatch",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }
      const planIndex = room.plans.findIndex((p) => p.id === plan.id);
      if (planIndex === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripPlan", id: plan.id }));
      }
      const updatedPlans = [...room.plans.slice(0, planIndex), plan, ...room.plans.slice(planIndex + 1)];
      const updated: TripRoom = {
        ...room,
        plans: updatedPlans,
        revision: RevisionSchema.make(room.revision + 1),
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
    deletePlan: (
      roomId: typeof TripIdSchema.Type,
      planId: typeof PlanIdSchema.Type,
      expectedRevision: typeof RevisionSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return Effect.fail(
          new ConflictError({
            message: "Revision mismatch",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }
      const updatedPlans = room.plans.filter((p) => p.id !== planId);
      const updated: TripRoom = {
        ...room,
        plans: updatedPlans,
        revision: RevisionSchema.make(room.revision + 1),
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
    confirmPlan: (
      roomId: typeof TripIdSchema.Type,
      planId: typeof PlanIdSchema.Type,
      expectedRevision: typeof RevisionSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return Effect.fail(
          new ConflictError({
            message: "Revision mismatch",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }
      const updatedPlans = room.plans.map((p) =>
        p.id === planId ? { ...p, status: "CONFIRMED" as const } : p
      );
      const updated: TripRoom = {
        ...room,
        confirmedPlanId: planId,
        plans: updatedPlans,
        revision: RevisionSchema.make(room.revision + 1),
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
    setPlanOpinion: (
      roomId: typeof TripIdSchema.Type,
      planId: typeof PlanIdSchema.Type,
      opinion: typeof import("../../domain/room.ts").PlanMemberOpinionSchema.Type,
      expectedRevision: typeof RevisionSchema.Type
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return Effect.fail(
          new ConflictError({
            message: "Revision mismatch",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }
      const planIndex = room.plans.findIndex((p) => p.id === planId);
      if (planIndex === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripPlan", id: planId }));
      }
      const targetPlan = room.plans[planIndex];
      const existingOpinions = targetPlan.memberOpinions ?? [];
      const opinionIndex = existingOpinions.findIndex((o) => o.userId === opinion.userId);
      const nextOpinions =
        opinionIndex >= 0
          ? [
              ...existingOpinions.slice(0, opinionIndex),
              opinion,
              ...existingOpinions.slice(opinionIndex + 1),
            ]
          : [...existingOpinions, opinion];
      const voteCount = nextOpinions.filter((o) => o.reaction === "LIKE").length;
      const updatedPlan: TripPlan = {
        ...targetPlan,
        memberOpinions: nextOpinions,
        voteCount,
      };
      const updatedPlans = [
        ...room.plans.slice(0, planIndex),
        updatedPlan,
        ...room.plans.slice(planIndex + 1),
      ];
      const updated: TripRoom = {
        ...room,
        plans: updatedPlans,
        revision: RevisionSchema.make(room.revision + 1),
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
    joinRoom: (
      roomId: typeof TripIdSchema.Type,
      member: TripMember
    ): Effect.Effect<TripRoom, NotFoundError> => {
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      const room = rooms[index];
      const alreadyMember = room.members.some((m) => m.id === member.id);
      if (alreadyMember) return Effect.succeed(room);
      const updated: TripRoom = {
        ...room,
        members: [...room.members, member],
      };
      rooms = [...rooms.slice(0, index), updated, ...rooms.slice(index + 1)];
      return Effect.succeed(updated);
    },
  };

  return Layer.succeed(TripRoomRepository, repoImpl);
};

const createTestSessionLayer = (
  session: UserSession
): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, makeLocalSessionService(session));

/**
 * 세션 저장소·인증 서버 장애를 재현하는 SessionService 구현
 * - 비로그인(UnauthorizedError)이 아니라 SessionUnavailableError로 실패한다
 */
const createUnavailableSessionLayer = (
  reason = "세션 저장소에 접근할 수 없습니다."
): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, {
    getCurrentSession: (): Effect.Effect<UserSession, SessionUnavailableError> =>
      Effect.fail(new SessionUnavailableError({ reason })),
    getCurrentUser: (): Effect.Effect<UserSession, SessionUnavailableError> =>
      Effect.fail(new SessionUnavailableError({ reason })),
  });

describe("세션 기반 단일 권한 주체 Use Case 검증 (RAON-129)", () => {
  const aliceUser: UserSession = {
    userId: UserIdSchema.make("user-alice"),
    name: "앨리스",
    isAuthenticated: true,
  };

  const bobUser: UserSession = {
    userId: UserIdSchema.make("user-bob"),
    name: "밥",
    isAuthenticated: true,
  };

  const strangerUser: UserSession = {
    userId: UserIdSchema.make("user-stranger"),
    name: "이방인",
    isAuthenticated: true,
  };

  const bob2User: UserSession = {
    userId: UserIdSchema.make("user-bob-2"),
    name: "밥",
    isAuthenticated: true,
  };

  const unauthenticatedSession: UserSession = {
    userId: UserIdSchema.make("anonymous"),
    name: "게스트",
    isAuthenticated: false,
  };

  const sampleRoom: TripRoom = {
    id: TripIdSchema.make("room-1"),
    title: "제주도 힐링 여행",
    destination: "제주도",
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    revision: RevisionSchema.make(1),
    members: [
      { id: UserIdSchema.make("user-alice"), name: "앨리스", role: "HOST" },
      { id: UserIdSchema.make("user-bob"), name: "밥", role: "MEMBER" },
    ],
    plans: [
      {
        id: PlanIdSchema.make("plan-1"),
        title: "기본 1안",
        status: "DRAFT",
        authorId: UserIdSchema.make("user-alice"),
        authorName: "앨리스",
        places: [],
        voteCount: 0,
      },
    ],
    confirmedPlanId: undefined,
  };

  describe("1. createTripRoomUseCase", () => {
    it("인증된 세션 사용자를 호스트(HOST)로 설정하여 방을 생성한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer(),
        createTestSessionLayer(aliceUser)
      );

      const program = createTripRoomUseCase({
        title: "도쿄 맛집 탐방",
        destination: "도쿄",
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      expect(room.title).toBe("도쿄 맛집 탐방");
      expect(room.members).toHaveLength(1);
      expect(room.members[0].id).toBe("user-alice");
      expect(room.members[0].name).toBe("앨리스");
      expect(room.members[0].role).toBe("HOST");
    });

    it("클라이언트가 임의의 hostUser를 전달해도 무시하고 세션 사용자를 호스트로 사용한다 (가장 방지)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer(),
        createTestSessionLayer(aliceUser)
      );

      // 타입에서는 hostUser를 받지 않지만(컴파일 타임 차단),
      // 런타임에서 주입되더라도 무시되는지 확인한다 (다층 방어)
      const spoofedInput = {
        title: "스위스 패키지",
        hostUser: {
          id: UserIdSchema.make("user-bob"),
          name: "가짜 밥",
          role: "HOST",
        },
      } as unknown as CreateRoomInput;

      const program = createTripRoomUseCase(spoofedInput).pipe(
        Effect.provide(testEnv)
      );

      const room = await Effect.runPromise(program);
      // 세션 사용자(user-alice)가 호스트로 강제되어야 함
      expect(room.members[0].id).toBe("user-alice");
      expect(room.members[0].name).toBe("앨리스");
    });

    it("비로그인 상태에서는 방 생성이 UnauthorizedError로 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer(),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = createTripRoomUseCase({
        title: "비로그인 방 생성 시도",
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("2. joinTripRoomUseCase", () => {
    it("인증된 세션 사용자의 신원(userId 및 name)으로 방에 참여한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(strangerUser)
      );

      const program = joinTripRoomUseCase({
        roomId: sampleRoom.id,
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      const joined = room.members.find((m) => m.id === "user-stranger");
      expect(joined).toBeDefined();
      expect(joined?.name).toBe("이방인");
      expect(joined?.role).toBe("MEMBER");
    });

    it("요청에 다른 userId나 name이 포함되어 있어도 세션 사용자의 정보로 참여한다 (가장 방지)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(strangerUser)
      );

      // 타입에서는 member를 받지 않지만(컴파일 타임 차단),
      // 런타임에서 주입되더라도 무시되는지 확인한다 (다층 방어)
      const spoofedInput = {
        roomId: sampleRoom.id,
        member: {
          id: UserIdSchema.make("user-spoofed"),
          name: "가짜 사용자",
          role: "HOST",
        },
      } as unknown as JoinRoomInput;

      const program = joinTripRoomUseCase(spoofedInput).pipe(
        Effect.provide(testEnv)
      );

      const room = await Effect.runPromise(program);
      expect(room.members.some((m) => m.id === "user-spoofed")).toBe(false);
      const joined = room.members.find((m) => m.id === "user-stranger");
      expect(joined).toBeDefined();
      expect(joined?.name).toBe("이방인"); // 가짜 사용자가 아닌 세션의 name('이방인')이어야 함
      expect(joined?.role).toBe("MEMBER");
    });

    it("비로그인 상태에서는 방 참여가 UnauthorizedError로 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = joinTripRoomUseCase({
        roomId: sampleRoom.id,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("3. createPlanUseCase", () => {
    it("방 참여자가 여행안 생성 시 세션 사용자가 authorId로 설정된다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      const newPlan: TripPlan = {
        id: PlanIdSchema.make("plan-2"),
        title: "밥의 대안",
        status: "DRAFT",
        places: [],
        voteCount: 0,
      };

      const program = createPlanUseCase({
        roomId: sampleRoom.id,
        plan: newPlan,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      const createdPlan = room.plans.find((p) => p.id === "plan-2");
      expect(createdPlan?.authorId).toBe("user-bob");
      expect(createdPlan?.authorName).toBe("밥");
    });

    it("클라이언트가 다른 authorId/authorName을 넘겨도 세션 사용자로 덮어쓴다 (가장 방지)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      const spoofedPlan: TripPlan = {
        id: PlanIdSchema.make("plan-3"),
        title: "위조된 작성자 여행안",
        status: "DRAFT",
        authorId: UserIdSchema.make("user-alice"), // 앨리스인 척 위조
        authorName: "앨리스",
        places: [],
        voteCount: 0,
      };

      const program = createPlanUseCase({
        roomId: sampleRoom.id,
        plan: spoofedPlan,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      const createdPlan = room.plans.find((p) => p.id === "plan-3");
      expect(createdPlan?.authorId).toBe("user-bob"); // 실제 세션인 밥이어야 함
      expect(createdPlan?.authorName).toBe("밥");
    });

    it("방 멤버가 아닌 이방인(GUEST)은 여행안 작성이 거부된다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(strangerUser)
      );

      const newPlan: TripPlan = {
        id: PlanIdSchema.make("plan-4"),
        title: "이방인의 여행안",
        status: "DRAFT",
        places: [],
        voteCount: 0,
      };

      const program = createPlanUseCase({
        roomId: sampleRoom.id,
        plan: newPlan,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("비로그인 상태에서는 여행안 작성이 거부된다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = createPlanUseCase({
        roomId: sampleRoom.id,
        plan: {
          id: PlanIdSchema.make("plan-5"),
          title: "비로그인 작성",
          status: "DRAFT",
          places: [],
          voteCount: 0,
        },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("4. updatePlanUseCase & deletePlanUseCase", () => {
    const roomWithBobPlan: TripRoom = {
      ...sampleRoom,
      plans: [
        ...sampleRoom.plans,
        {
          id: PlanIdSchema.make("plan-bob"),
          title: "밥의 제안",
          status: "DRAFT",
          authorId: UserIdSchema.make("user-bob"),
          authorName: "밥",
          places: [],
          voteCount: 0,
        },
      ],
    };

    it("작성자가 자신의 여행안 수정 시 기존 작성자 정보를 보존하며 정상 수정된다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(aliceUser)
      );

      const updateTarget: TripPlan = {
        ...sampleRoom.plans[0],
        title: "수정된 기본 1안",
        authorId: UserIdSchema.make("user-hacker"), // 작성자 변조 시도
      };

      const program = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: updateTarget,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      const plan = room.plans.find((p) => p.id === "plan-1");
      expect(plan?.title).toBe("수정된 기본 1안");
      expect(plan?.authorId).toBe("user-alice"); // 원래 작성자 유지
    });

    it("작성자나 방장이 아닌 일반 멤버(MEMBER)가 다른 사람의 여행안 수정을 시도하면 UnauthorizedError로 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      const updateTarget: TripPlan = {
        ...sampleRoom.plans[0],
        title: "밥이 앨리스의 여행안 수정 시도",
      };

      const program = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: updateTarget,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("작성자나 방장이 아닌 일반 멤버(MEMBER)가 다른 사람의 여행안 삭제를 시도하면 UnauthorizedError로 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      const program = deletePlanUseCase({
        roomId: sampleRoom.id,
        planId: sampleRoom.plans[0].id,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("방장(HOST)이라도 타 멤버(MEMBER)가 작성한 여행안 수정을 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithBobPlan]),
        createTestSessionLayer(aliceUser)
      );

      const updateTarget: TripPlan = {
        ...roomWithBobPlan.plans[1],
        title: "방장이 타인의 여행안 수정 시도",
      };

      const updateProgram = updatePlanUseCase({
        roomId: roomWithBobPlan.id,
        plan: updateTarget,
        expectedRevision: roomWithBobPlan.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(updateProgram);
        expect.unreachable("host should not be allowed to update other member's plan");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 원본 데이터가 손상되지 않고 보존되었는지 검증
      const getProgram = TripRoomRepository.pipe(
        Effect.flatMap((repo) => repo.getRoom(roomWithBobPlan.id)),
        Effect.provide(testEnv)
      );
      const room = await Effect.runPromise(getProgram);
      const bobPlan = room.plans.find((p) => p.id === "plan-bob");
      expect(bobPlan?.title).toBe("밥의 제안");
      expect(bobPlan?.authorId).toBe("user-bob");
    });

    it("방장(HOST)이라도 타 멤버(MEMBER)가 작성한 여행안 삭제를 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithBobPlan]),
        createTestSessionLayer(aliceUser)
      );

      const deleteProgram = deletePlanUseCase({
        roomId: roomWithBobPlan.id,
        planId: PlanIdSchema.make("plan-bob"),
        expectedRevision: roomWithBobPlan.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(deleteProgram);
        expect.unreachable("host should not be allowed to delete other member's plan");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 원본 데이터가 삭제되지 않고 보존되었는지 검증
      const getProgram = TripRoomRepository.pipe(
        Effect.flatMap((repo) => repo.getRoom(roomWithBobPlan.id)),
        Effect.provide(testEnv)
      );
      const room = await Effect.runPromise(getProgram);
      expect(room.plans.some((p) => p.id === "plan-bob")).toBe(true);
    });

    it("작성자(HOST)는 자신이 작성한 여행안을 정상적으로 수정 및 삭제할 수 있다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(aliceUser)
      );

      const updateTarget: TripPlan = {
        ...sampleRoom.plans[0],
        title: "방장이 자신이 작성한 여행안 수정",
      };

      const updateProgram = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: updateTarget,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const updatedRoom = await Effect.runPromise(updateProgram);
      const updatedPlan = updatedRoom.plans.find((p) => p.id === "plan-1");
      expect(updatedPlan?.title).toBe("방장이 자신이 작성한 여행안 수정");
      expect(updatedPlan?.authorId).toBe("user-alice");

      const deleteProgram = deletePlanUseCase({
        roomId: updatedRoom.id,
        planId: PlanIdSchema.make("plan-1"),
        expectedRevision: updatedRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const finalRoom = await Effect.runPromise(deleteProgram);
      expect(finalRoom.plans.some((p) => p.id === "plan-1")).toBe(false);
    });

    it("존재하지 않는 여행안을 수정 또는 삭제하려고 하면 NotFoundError로 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(aliceUser)
      );

      const nonExistentPlan: TripPlan = {
        ...sampleRoom.plans[0],
        id: PlanIdSchema.make("plan-does-not-exist"),
        title: "존재하지 않는 플랜",
      };

      const updateProgram = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: nonExistentPlan,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(updateProgram);
        expect.unreachable("should fail with NotFoundError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NotFoundError);
      }

      const deleteProgram = deletePlanUseCase({
        roomId: sampleRoom.id,
        planId: PlanIdSchema.make("plan-does-not-exist"),
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(deleteProgram);
        expect.unreachable("should fail with NotFoundError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NotFoundError);
      }
    });

    it("작성자(MEMBER)는 자신이 작성한 여행안을 정상적으로 삭제할 수 있다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithBobPlan]),
        createTestSessionLayer(bobUser)
      );

      const deleteProgram = deletePlanUseCase({
        roomId: roomWithBobPlan.id,
        planId: PlanIdSchema.make("plan-bob"),
        expectedRevision: roomWithBobPlan.revision,
      }).pipe(Effect.provide(testEnv));

      const finalRoom = await Effect.runPromise(deleteProgram);
      expect(finalRoom.plans.some((p) => p.id === "plan-bob")).toBe(false);
    });

    it("authorId가 누락된 레거시 여행안도 authorName이 일치하는 멤버(MEMBER)가 수정 및 삭제할 수 있고 authorId가 보정된다", async () => {
      const roomWithLegacyPlan: TripRoom = {
        ...sampleRoom,
        plans: [
          ...sampleRoom.plans,
          {
            id: PlanIdSchema.make("plan-legacy-bob"),
            title: "밥의 구버전 제안",
            status: "DRAFT",
            authorId: undefined, // 레거시 데이터로 authorId 누락
            authorName: "밥",
            places: [],
            voteCount: 0,
          },
        ],
      };

      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithLegacyPlan]),
        createTestSessionLayer(bobUser)
      );

      // 밥(MEMBER)이 자신의 이름으로 된 레거시 여행안 수정
      const updateTarget: TripPlan = {
        ...roomWithLegacyPlan.plans[1],
        title: "밥이 수정한 구버전 제안",
      };

      const updateProgram = updatePlanUseCase({
        roomId: roomWithLegacyPlan.id,
        plan: updateTarget,
        expectedRevision: roomWithLegacyPlan.revision,
      }).pipe(Effect.provide(testEnv));

      const updatedRoom = await Effect.runPromise(updateProgram);
      const updatedPlan = updatedRoom.plans.find((p) => p.id === "plan-legacy-bob");
      expect(updatedPlan?.title).toBe("밥이 수정한 구버전 제안");
      expect(updatedPlan?.authorId).toBe("user-bob"); // authorId가 성공적으로 보정됨
      expect(updatedPlan?.authorName).toBe("밥");

      // 밥이 자신의 레거시 여행안 삭제
      const deleteProgram = deletePlanUseCase({
        roomId: updatedRoom.id,
        planId: PlanIdSchema.make("plan-legacy-bob"),
        expectedRevision: updatedRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const finalRoom = await Effect.runPromise(deleteProgram);
      expect(finalRoom.plans.some((p) => p.id === "plan-legacy-bob")).toBe(false);
    });

    it("authorId가 누락된 레거시 여행안이라도 타 멤버(MEMBER)의 수정 및 삭제는 거절된다", async () => {
      const roomWithLegacyPlan: TripRoom = {
        ...sampleRoom,
        members: [...sampleRoom.members, { id: UserIdSchema.make("user-stranger"), name: "이방인", role: "MEMBER" }],
        plans: [
          ...sampleRoom.plans,
          {
            id: PlanIdSchema.make("plan-legacy-bob"),
            title: "밥의 구버전 제안",
            status: "DRAFT",
            authorId: undefined,
            authorName: "밥",
            places: [],
            voteCount: 0,
          },
        ],
      };

      const strangerEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithLegacyPlan]),
        createTestSessionLayer(strangerUser)
      );

      const updateProgram = updatePlanUseCase({
        roomId: roomWithLegacyPlan.id,
        plan: { ...roomWithLegacyPlan.plans[1], title: "이방인의 수정 시도" },
        expectedRevision: roomWithLegacyPlan.revision,
      }).pipe(Effect.provide(strangerEnv));

      try {
        await Effect.runPromise(updateProgram);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      const deleteProgram = deletePlanUseCase({
        roomId: roomWithLegacyPlan.id,
        planId: PlanIdSchema.make("plan-legacy-bob"),
        expectedRevision: roomWithLegacyPlan.revision,
      }).pipe(Effect.provide(strangerEnv));

      try {
        await Effect.runPromise(deleteProgram);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("authorId가 누락된 레거시 여행안의 authorName과 일치하는 참여자가 여러 명(동명이인)일 경우 일반 멤버의 수정/삭제는 거부된다", async () => {
      const roomWithDuplicateNames: TripRoom = {
        ...sampleRoom,
        members: [
          ...sampleRoom.members, // user-alice ("앨리스"), user-bob ("밥")
          { id: UserIdSchema.make("user-bob-2"), name: "밥", role: "MEMBER" }, // 동명이인 밥 2
        ],
        plans: [
          ...sampleRoom.plans,
          {
            id: PlanIdSchema.make("plan-legacy-bob"),
            title: "밥의 구버전 제안",
            status: "DRAFT",
            authorId: undefined,
            authorName: "밥",
            places: [],
            voteCount: 0,
          },
        ],
      };

      const bob1Env = Layer.merge(
        createInMemoryRepositoryLayer([roomWithDuplicateNames]),
        createTestSessionLayer(bobUser)
      );
      const bob2Env = Layer.merge(
        createInMemoryRepositoryLayer([roomWithDuplicateNames]),
        createTestSessionLayer(bob2User)
      );

      // 밥1의 수정 시도 -> 실패
      try {
        await Effect.runPromise(
          updatePlanUseCase({
            roomId: roomWithDuplicateNames.id,
            plan: { ...roomWithDuplicateNames.plans[1], title: "밥1의 수정 시도" },
            expectedRevision: roomWithDuplicateNames.revision,
          }).pipe(Effect.provide(bob1Env))
        );
        expect.unreachable("bob1 update should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 밥2의 수정 시도 -> 실패
      try {
        await Effect.runPromise(
          updatePlanUseCase({
            roomId: roomWithDuplicateNames.id,
            plan: { ...roomWithDuplicateNames.plans[1], title: "밥2의 수정 시도" },
            expectedRevision: roomWithDuplicateNames.revision,
          }).pipe(Effect.provide(bob2Env))
        );
        expect.unreachable("bob2 update should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 밥1의 삭제 시도 -> 실패
      try {
        await Effect.runPromise(
          deletePlanUseCase({
            roomId: roomWithDuplicateNames.id,
            planId: PlanIdSchema.make("plan-legacy-bob"),
            expectedRevision: roomWithDuplicateNames.revision,
          }).pipe(Effect.provide(bob1Env))
        );
        expect.unreachable("bob1 delete should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 밥2의 삭제 시도 -> 실패
      try {
        await Effect.runPromise(
          deletePlanUseCase({
            roomId: roomWithDuplicateNames.id,
            planId: PlanIdSchema.make("plan-legacy-bob"),
            expectedRevision: roomWithDuplicateNames.revision,
          }).pipe(Effect.provide(bob2Env))
        );
        expect.unreachable("bob2 delete should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("동명이인이 존재하는 레거시 여행안을 방장이 수정/삭제할 수 있어 영구 잠금을 방지하며 임의의 동명이인 ID로 잘못 고정되지 않고 authorId undefined가 유지된다", async () => {
      const roomWithDuplicateNames: TripRoom = {
        ...sampleRoom,
        members: [
          ...sampleRoom.members,
          { id: UserIdSchema.make("user-bob-2"), name: "밥", role: "MEMBER" },
        ],
        plans: [
          ...sampleRoom.plans,
          {
            id: PlanIdSchema.make("plan-legacy-bob"),
            title: "밥의 구버전 제안",
            status: "DRAFT",
            authorId: undefined,
            authorName: "밥",
            places: [],
            voteCount: 0,
          },
        ],
      };

      const hostEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithDuplicateNames]),
        createTestSessionLayer(aliceUser)
      );

      // 1. 방장의 수정 허용 및 authorId 미오염 검증
      const updateProgram = updatePlanUseCase({
        roomId: roomWithDuplicateNames.id,
        plan: { ...roomWithDuplicateNames.plans[1], title: "방장이 수정한 모호한 여행안" },
        expectedRevision: roomWithDuplicateNames.revision,
      }).pipe(Effect.provide(hostEnv));

      const updatedRoom = await Effect.runPromise(updateProgram);
      const updatedPlan = updatedRoom.plans.find((p) => p.id === "plan-legacy-bob");
      expect(updatedPlan?.title).toBe("방장이 수정한 모호한 여행안");
      expect(updatedPlan?.authorId).toBeUndefined(); // 임의의 멤버나 방장으로 잘못 변조되지 않음
      expect(updatedPlan?.authorName).toBe("밥");

      // 2. 방장의 삭제 허용 검증
      const deleteProgram = deletePlanUseCase({
        roomId: updatedRoom.id,
        planId: PlanIdSchema.make("plan-legacy-bob"),
        expectedRevision: updatedRoom.revision,
      }).pipe(Effect.provide(hostEnv));

      const finalRoom = await Effect.runPromise(deleteProgram);
      expect(finalRoom.plans.some((p) => p.id === "plan-legacy-bob")).toBe(false);
    });

    it("비로그인 상태에서 여행안 수정 및 삭제는 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const updateProg = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: sampleRoom.plans[0],
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(updateProg);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      const deleteProg = deletePlanUseCase({
        roomId: sampleRoom.id,
        planId: sampleRoom.plans[0].id,
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(deleteProg);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("5. submitPlanOpinionUseCase", () => {
    it("세션 사용자의 정보로 의견과 투표를 등록한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      const program = submitPlanOpinionUseCase({
        roomId: sampleRoom.id,
        planId: PlanIdSchema.make("plan-1"),
        opinion: {
          reaction: "LIKE",
          reason: "좋아요!",
        },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      const plan = room.plans.find((p) => p.id === "plan-1");
      expect(plan?.memberOpinions).toHaveLength(1);
      expect(plan?.memberOpinions?.[0].userId).toBe("user-bob");
      expect(plan?.memberOpinions?.[0].userName).toBe("밥");
      expect(plan?.voteCount).toBe(1);
    });

    it("클라이언트가 다른 userId를 전달해도 세션 사용자의 userId로 기록된다 (의견 위조 방지)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      // 타입에서는 userId/userName을 받지 않지만(컴파일 타임 차단),
      // 런타임에서 주입되더라도 무시되는지 확인한다 (다층 방어)
      const spoofedInput = {
        roomId: sampleRoom.id,
        planId: PlanIdSchema.make("plan-1"),
        opinion: {
          reaction: "HARD",
          reason: "일정이 빡빡해요",
          userId: UserIdSchema.make("user-alice"), // 앨리스의 의견인 것처럼 조작 시도
          userName: "앨리스",
        },
        expectedRevision: sampleRoom.revision,
      } as unknown as SubmitPlanOpinionInput;

      const program = submitPlanOpinionUseCase(spoofedInput).pipe(
        Effect.provide(testEnv)
      );

      const room = await Effect.runPromise(program);
      const plan = room.plans.find((p) => p.id === "plan-1");
      expect(plan?.memberOpinions?.[0].userId).toBe("user-bob");
      expect(plan?.memberOpinions?.[0].userName).toBe("밥");
    });

    it("비로그인 상태에서는 의견 등록이 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = submitPlanOpinionUseCase({
        roomId: sampleRoom.id,
        planId: PlanIdSchema.make("plan-1"),
        opinion: {
          reaction: "LIKE",
        },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("6. confirmTripPlan", () => {
    it("방 참여자가 여행안을 확정할 수 있다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(aliceUser)
      );

      const program = confirmTripPlan(
        sampleRoom.id,
        PlanIdSchema.make("plan-1"),
        sampleRoom.revision
      ).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      expect(room.confirmedPlanId).toBe("plan-1");
    });

    it("비로그인 상태에서는 여행안 확정이 실패한다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = confirmTripPlan(
        sampleRoom.id,
        PlanIdSchema.make("plan-1"),
        sampleRoom.revision
      ).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("7. SessionService 어댑터 및 헬퍼 일관성 검증", () => {
    it("기본 LocalSessionLayer는 인증된 사용자 세션을 제공한다", async () => {
      const session = await Effect.runPromise(
        requireAuthSession().pipe(Effect.provide(createLocalSessionLayer()))
      );
      expect(session.userId).toBe(DEFAULT_LOCAL_USER.userId);
      expect(session.isAuthenticated).toBe(true);
    });

    it("getCurrentUser helper는 인증되지 않은 세션일 때 UnauthorizedError로 실패한다", async () => {
      const unauthLayer = createTestSessionLayer(unauthenticatedSession);
      const program = getCurrentUser("테스트 로그인 필요").pipe(Effect.provide(unauthLayer));
      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("getOptionalSession helper는 비로그인 시 None을 반환한다", async () => {
      const unauthLayer = createTestSessionLayer(unauthenticatedSession);
      const result = await Effect.runPromise(getOptionalSession.pipe(Effect.provide(unauthLayer)));
      expect(Option.isNone(result)).toBe(true);
    });
  });
  describe("8. 세션 조회 실패(SessionUnavailableError)와 비로그인 구분 (RAON-149)", () => {
    it("getOptionalSession은 세션 조회 실패를 None으로 삼키지 않고 전파한다", async () => {
      const program = getOptionalSession.pipe(
        Effect.provide(createUnavailableSessionLayer())
      );

      try {
        await Effect.runPromise(program);
        expect.unreachable("session lookup failure should not be swallowed");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(SessionUnavailableError);
        expect(err).not.toBeInstanceOf(UnauthorizedError);
      }
    });

    it("requireAuthSession은 세션 조회 실패를 UnauthorizedError로 바꾸지 않고 사유를 보존한다", async () => {
      const program = requireAuthSession("여행안을 작성하려면 로그인이 필요합니다.").pipe(
        Effect.provide(createUnavailableSessionLayer("네트워크에 연결할 수 없습니다."))
      );

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(SessionUnavailableError);
        expect((err as SessionUnavailableError).reason).toBe(
          "네트워크에 연결할 수 없습니다."
        );
      }
    });

    it("세션 조회에 실패하면 쓰기 작업이 SessionUnavailableError로 실패하고 저장소가 변경되지 않는다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createUnavailableSessionLayer()
      );

      const program = createPlanUseCase({
        roomId: sampleRoom.id,
        plan: {
          id: PlanIdSchema.make("plan-new"),
          title: "세션 장애 중 작성 시도",
          status: "DRAFT",
          places: [],
          voteCount: 0,
        },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(SessionUnavailableError);
      }

      const room = await Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((repo) => repo.getRoom(sampleRoom.id)),
          Effect.provide(testEnv)
        )
      );
      expect(room.plans).toHaveLength(1);
    });

    it("비로그인은 여전히 None으로 매핑되어 조회 실패와 구분된다", async () => {
      const result = await Effect.runPromise(
        getOptionalSession.pipe(
          Effect.provide(createTestSessionLayer(unauthenticatedSession))
        )
      );
      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe("9. 인증이 입력 검증보다 먼저 수행된다 (RAON-149)", () => {
    it("비로그인 상태에서 제목이 비어 있어도 ValidationError가 아닌 UnauthorizedError로 실패한다 (방 생성)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer(),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = createTripRoomUseCase({ title: "   " }).pipe(
        Effect.provide(testEnv)
      );

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err).not.toBeInstanceOf(ValidationError);
      }
    });

    it("로그인 상태에서 제목이 비어 있으면 ValidationError로 실패한다 (대조군)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer(),
        createTestSessionLayer(aliceUser)
      );

      const program = createTripRoomUseCase({ title: "   " }).pipe(
        Effect.provide(testEnv)
      );

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ValidationError);
      }
    });

    it("비로그인 상태에서 여행안 제목이 비어 있어도 UnauthorizedError로 실패한다 (여행안 작성)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = createPlanUseCase({
        roomId: sampleRoom.id,
        plan: {
          id: PlanIdSchema.make("plan-empty"),
          title: "  ",
          status: "DRAFT",
          places: [],
          voteCount: 0,
        },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err).not.toBeInstanceOf(ValidationError);
      }
    });

    it("비로그인 상태에서 인원수가 잘못되어 있어도 UnauthorizedError로 실패한다 (여행안 수정)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: { ...sampleRoom.plans[0], baseHeadcount: 0 },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err).not.toBeInstanceOf(ValidationError);
      }
    });

    it("비로그인 상태에서 리액션 값이 잘못되어 있어도 UnauthorizedError로 실패한다 (의견 등록)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = submitPlanOpinionUseCase({
        roomId: sampleRoom.id,
        planId: PlanIdSchema.make("plan-1"),
        opinion: { reaction: "INVALID" as "LIKE" },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err).not.toBeInstanceOf(ValidationError);
      }
    });

    it("비로그인 상태에서 방 제목이 비어 있어도 UnauthorizedError로 실패한다 (방 정보 수정)", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(unauthenticatedSession)
      );

      const program = updateTripRoomUseCase({
        roomId: sampleRoom.id,
        params: { title: "   " },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err).not.toBeInstanceOf(ValidationError);
      }
    });
  });

  describe("10. updateTripRoomUseCase 권한 검증", () => {
    it("방장(HOST)은 방 정보를 수정할 수 있다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(aliceUser)
      );

      const program = updateTripRoomUseCase({
        roomId: sampleRoom.id,
        params: { title: "제주도 미식 여행" },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);
      expect(room.title).toBe("제주도 미식 여행");
    });

    it("일반 멤버(MEMBER)는 방 정보를 수정할 수 없다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([sampleRoom]),
        createTestSessionLayer(bobUser)
      );

      const program = updateTripRoomUseCase({
        roomId: sampleRoom.id,
        params: { title: "밥이 바꾼 제목" },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      try {
        await Effect.runPromise(program);
        expect.unreachable("member should not be allowed to update room");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      const room = await Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((repo) => repo.getRoom(sampleRoom.id)),
          Effect.provide(testEnv)
        )
      );
      expect(room.title).toBe("제주도 힐링 여행");
    });
  });
});
