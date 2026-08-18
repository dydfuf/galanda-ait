import { describe, expect, it } from "vitest";
import { Effect, Layer, Option } from "effect";
import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "../../domain/ids.ts";
import type { TripMember, TripPlan, TripRoom, UserSession } from "../../domain/room.ts";
import { SessionService, requireAuthSession, getCurrentUser, getOptionalSession } from "../../ports/session.ts";
import { TripRoomRepository, type CreateRoomParams, type UpdateRoomParams } from "../../ports/trip-room-repository.ts";
import { createLocalSessionLayer, DEFAULT_LOCAL_USER, makeLocalSessionService } from "../../../infrastructure/local/local-session.ts";
import { createTripRoomUseCase } from "../create-room.ts";
import { joinTripRoomUseCase } from "../join-room.ts";
import { createPlanUseCase, updatePlanUseCase, deletePlanUseCase } from "../save-plan.ts";
import { submitPlanOpinionUseCase } from "../submit-opinion.ts";
import { confirmTripPlan } from "../confirm-plan.ts";
import { NotFoundError, ConflictError, UnauthorizedError } from "../../domain/errors.ts";

/**
 * 테스트용 인메모리 TripRoomRepository 구현체 생성 헬퍼
 */
const createInMemoryRepositoryLayer = (initialRooms: TripRoom[] = []) => {
  let rooms: TripRoom[] = [...initialRooms];

  const repoImpl = {
    getRoom: (roomId: typeof TripIdSchema.Type) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      return Effect.succeed(room);
    },
    getRooms: () => Effect.succeed(rooms),
    createRoom: (params: CreateRoomParams) => {
      const hostUser: TripMember = params.hostUser ?? {
        id: UserIdSchema.make("default-host"),
        name: "호스트",
        role: "HOST",
      };
      const newRoom: TripRoom = {
        id: TripIdSchema.make(`room-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
        title: params.title,
        destination: params.destination ?? "목적지",
        startDate: params.startDate ?? "2026-09-01",
        endDate: params.endDate ?? "2026-09-05",
        revision: RevisionSchema.make(1),
        members: [hostUser],
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
    ) => {
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
    ) => {
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
    ) => {
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
    ) => {
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
    ) => {
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
    ) => {
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
    joinRoom: (roomId: typeof TripIdSchema.Type, member: TripMember) => {
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

const createTestSessionLayer = (session: UserSession) =>
  Layer.succeed(SessionService, makeLocalSessionService(session));

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

      // 클라이언트가 임의의 user-bob을 hostUser로 주입 시도
      const program = createTripRoomUseCase({
        title: "스위스 패키지",
        hostUser: {
          id: UserIdSchema.make("user-bob"),
          name: "가짜 밥",
          role: "HOST",
        },
      } as any).pipe(Effect.provide(testEnv));

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

      const program = joinTripRoomUseCase({
        roomId: sampleRoom.id,
        member: {
          id: UserIdSchema.make("user-spoofed"),
          name: "가짜 사용자",
          role: "HOST",
        },
      }).pipe(Effect.provide(testEnv));

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

    it("방장(HOST)은 다른 멤버가 작성한 여행안도 수정 및 삭제할 수 있다", async () => {
      const testEnv = Layer.merge(
        createInMemoryRepositoryLayer([roomWithBobPlan]),
        createTestSessionLayer(aliceUser)
      );

      const updateTarget: TripPlan = {
        ...roomWithBobPlan.plans[1],
        title: "방장이 수정한 밥의 제안",
      };

      const updateProgram = updatePlanUseCase({
        roomId: roomWithBobPlan.id,
        plan: updateTarget,
        expectedRevision: roomWithBobPlan.revision,
      }).pipe(Effect.provide(testEnv));

      const updatedRoom = await Effect.runPromise(updateProgram);
      const updatedPlan = updatedRoom.plans.find((p) => p.id === "plan-bob");
      expect(updatedPlan?.title).toBe("방장이 수정한 밥의 제안");
      expect(updatedPlan?.authorId).toBe("user-bob");

      const deleteProgram = deletePlanUseCase({
        roomId: updatedRoom.id,
        planId: PlanIdSchema.make("plan-bob"),
        expectedRevision: updatedRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const finalRoom = await Effect.runPromise(deleteProgram);
      expect(finalRoom.plans.some((p) => p.id === "plan-bob")).toBe(false);
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

      const program = submitPlanOpinionUseCase({
        roomId: sampleRoom.id,
        planId: PlanIdSchema.make("plan-1"),
        opinion: {
          reaction: "HARD",
          reason: "일정이 빡빡해요",
          userId: UserIdSchema.make("user-alice"), // 앨리스의 의견인 것처럼 조작 시도
          userName: "앨리스",
        },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

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
});
