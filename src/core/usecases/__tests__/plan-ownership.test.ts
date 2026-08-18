import { describe, expect, it, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "../../domain/ids.ts";
import type { TripMember, TripPlan, TripRoom, UserSession } from "../../domain/room.ts";
import { SessionService } from "../../ports/session.ts";
import { TripRoomRepository } from "../../ports/trip-room-repository.ts";
import { createPlanUseCase, updatePlanUseCase, deletePlanUseCase } from "../save-plan.ts";
import { isPlanAuthor, requirePlanAuthor } from "../../domain/auth-guards.ts";
import { NotFoundError, UnauthorizedError, ConflictError } from "../../domain/errors.ts";
import { LocalTripRoomRepositoryLayer } from "../../../infrastructure/local/local-trip-room-repo.ts";
import { createLocalSessionLayer } from "../../../infrastructure/local/local-session.ts";

/**
 * 인메모리 테스트 레포지토리
 */
const createInMemoryRepo = (initialRooms: TripRoom[]) => {
  let rooms = [...initialRooms];

  return Layer.succeed(TripRoomRepository, {
    getRoom: (roomId) => {
      const found = rooms.find((r) => r.id === roomId);
      if (!found) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      return Effect.succeed(found);
    },
    getRooms: () => Effect.succeed(rooms),
    createRoom: () => Effect.die("not implemented in test"),
    updateRoom: () => Effect.die("not implemented in test"),
    createPlan: (roomId, plan, expectedRevision) => {
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      if (rooms[idx].revision !== expectedRevision) {
        return Effect.fail(new ConflictError({ message: "conflict", expectedRevision, actualRevision: rooms[idx].revision }));
      }
      const updated: TripRoom = {
        ...rooms[idx],
        plans: [...rooms[idx].plans, plan],
        revision: RevisionSchema.make(rooms[idx].revision + 1),
      };
      rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
      return Effect.succeed(updated);
    },
    updatePlan: (roomId, plan, expectedRevision) => {
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      if (rooms[idx].revision !== expectedRevision) {
        return Effect.fail(new ConflictError({ message: "conflict", expectedRevision, actualRevision: rooms[idx].revision }));
      }
      const planIdx = rooms[idx].plans.findIndex((p) => p.id === plan.id);
      if (planIdx === -1) return Effect.fail(new NotFoundError({ entity: "TripPlan", id: plan.id }));
      const updatedPlans = [...rooms[idx].plans.slice(0, planIdx), plan, ...rooms[idx].plans.slice(planIdx + 1)];
      const updated: TripRoom = {
        ...rooms[idx],
        plans: updatedPlans,
        revision: RevisionSchema.make(rooms[idx].revision + 1),
      };
      rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
      return Effect.succeed(updated);
    },
    deletePlan: (roomId, planId, expectedRevision) => {
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      if (rooms[idx].revision !== expectedRevision) {
        return Effect.fail(new ConflictError({ message: "conflict", expectedRevision, actualRevision: rooms[idx].revision }));
      }
      const updatedPlans = rooms[idx].plans.filter((p) => p.id !== planId);
      const updated: TripRoom = {
        ...rooms[idx],
        plans: updatedPlans,
        revision: RevisionSchema.make(rooms[idx].revision + 1),
      };
      rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
      return Effect.succeed(updated);
    },
    confirmPlan: () => Effect.die("not implemented"),
    setPlanOpinion: () => Effect.die("not implemented"),
    joinRoom: () => Effect.die("not implemented"),
  });
};

const createSessionLayer = (session: UserSession) =>
  Layer.succeed(SessionService, {
    getCurrentSession: () => Effect.succeed(session),
    getCurrentUser: () =>
      session.isAuthenticated
        ? Effect.succeed(session)
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
  });

describe("RAON-138: 여행안 소유권 보호 (Plan Ownership Protection)", () => {
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
  const strangerUser: TripMember = {
    id: UserIdSchema.make("user-stranger"),
    name: "다른참여자",
    role: "MEMBER",
  };

  const authorPlan: TripPlan = {
    id: PlanIdSchema.make("plan-author-1"),
    title: "작성자의 여행안",
    status: "DRAFT",
    authorId: authorUser.id,
    authorName: authorUser.name,
    places: [],
    voteCount: 0,
  };

  const hostPlan: TripPlan = {
    id: PlanIdSchema.make("plan-host-1"),
    title: "방장의 여행안",
    status: "DRAFT",
    authorId: hostUser.id,
    authorName: hostUser.name,
    places: [],
    voteCount: 0,
  };

  const sampleRoom: TripRoom = {
    id: TripIdSchema.make("room-101"),
    title: "제주도 3박 4일",
    destination: "제주도",
    startDate: "2026-09-01",
    endDate: "2026-09-04",
    revision: RevisionSchema.make(1),
    members: [hostUser, authorUser, strangerUser],
    plans: [hostPlan, authorPlan],
    confirmedPlanId: undefined,
  };

  const hostSession: UserSession = {
    userId: hostUser.id,
    name: hostUser.name,
    isAuthenticated: true,
  };

  const authorSession: UserSession = {
    userId: authorUser.id,
    name: authorUser.name,
    isAuthenticated: true,
  };

  const strangerSession: UserSession = {
    userId: strangerUser.id,
    name: strangerUser.name,
    isAuthenticated: true,
  };

  const unauthenticatedSession: UserSession = {
    userId: UserIdSchema.make("user-anonymous"),
    name: "비로그인",
    isAuthenticated: false,
  };

  describe("1. isPlanAuthor & requirePlanAuthor 도메인 함수 및 가드 검증", () => {
    it("authorId가 세션 userId와 일치할 때만 isPlanAuthor가 true를 반환한다", () => {
      expect(isPlanAuthor(sampleRoom, authorPlan, authorUser.id)).toBe(true);
      expect(isPlanAuthor(sampleRoom, authorPlan, hostUser.id)).toBe(false);
      expect(isPlanAuthor(sampleRoom, authorPlan, strangerUser.id)).toBe(false);
      expect(isPlanAuthor(sampleRoom, authorPlan, undefined)).toBe(false);
    });

    it("requirePlanAuthor 가드는 작성자에게만 성공하고 비작성자/방장에게는 UnauthorizedError를 반환한다", async () => {
      const authorSuccess = await Effect.runPromise(
        requirePlanAuthor(sampleRoom, authorPlan, authorUser.id)
      );
      expect(authorSuccess.isMember).toBe(true);

      const hostFail = requirePlanAuthor(sampleRoom, authorPlan, hostUser.id);
      try {
        await Effect.runPromise(hostFail);
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("authorId가 없고 authorName만 존재할 때, 유일한 멤버 매칭 시에만 true를 반환한다", () => {
      const legacyPlan: TripPlan = {
        id: PlanIdSchema.make("plan-legacy"),
        title: "레거시 플랜",
        status: "DRAFT",
        authorName: "작성자",
        places: [],
        voteCount: 0,
      };

      expect(isPlanAuthor(sampleRoom, legacyPlan, authorUser.id)).toBe(true);
      expect(isPlanAuthor(sampleRoom, legacyPlan, hostUser.id)).toBe(false);
      expect(isPlanAuthor(sampleRoom, legacyPlan, strangerUser.id)).toBe(false);
    });

    it("authorId가 없고 authorName과 일치하는 동명이인이 2명 이상이면 모두 false를 반환한다", () => {
      const roomWithDuplicates: TripRoom = {
        ...sampleRoom,
        members: [
          ...sampleRoom.members,
          { id: UserIdSchema.make("user-author-2"), name: "작성자", role: "MEMBER" },
        ],
      };
      const legacyPlan: TripPlan = {
        id: PlanIdSchema.make("plan-legacy"),
        title: "레거시 플랜",
        status: "DRAFT",
        authorName: "작성자",
        places: [],
        voteCount: 0,
      };

      expect(isPlanAuthor(roomWithDuplicates, legacyPlan, authorUser.id)).toBe(false);
      expect(isPlanAuthor(roomWithDuplicates, legacyPlan, UserIdSchema.make("user-author-2"))).toBe(false);
    });
  });

  describe("2. Use Case 기반 플랜 생성 시 작성자 지정", () => {
    it("createPlanUseCase는 세션 사용자를 작성자로 등록한다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      const newPlan: TripPlan = {
        id: PlanIdSchema.make("plan-new-1"),
        title: "신규 제안",
        status: "DRAFT",
        places: [],
        voteCount: 0,
      };

      const res = await Effect.runPromise(
        createPlanUseCase({
          roomId: sampleRoom.id,
          plan: newPlan,
          expectedRevision: sampleRoom.revision,
        }).pipe(Effect.provide(env))
      );

      const created = res.plans.find((p) => p.id === "plan-new-1");
      expect(created?.authorId).toBe(authorUser.id);
      expect(created?.authorName).toBe(authorUser.name);
    });
  });

  describe("3. Use Case 기반 소유권 수정 보호", () => {
    it("작성자(MEMBER)는 자신의 여행안을 정상 수정할 수 있다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        updatePlanUseCase({
          roomId: sampleRoom.id,
          plan: { ...authorPlan, title: "작성자가 수정한 제목" },
          expectedRevision: sampleRoom.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === authorPlan.id);
      expect(target?.title).toBe("작성자가 수정한 제목");
      expect(target?.authorId).toBe(authorUser.id);
    });

    it("방장(HOST)이라도 타인의 여행안 수정을 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(hostSession)
      );

      const program = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: { ...authorPlan, title: "방장이 변조하려는 제목" },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(env));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 원본 보존 확인
      const check = await Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((r) => r.getRoom(sampleRoom.id)),
          Effect.provide(env)
        )
      );
      const plan = check.plans.find((p) => p.id === authorPlan.id);
      expect(plan?.title).toBe("작성자의 여행안");
      expect(check.revision).toBe(1);
    });

    it("다른 일반 참여자(MEMBER)가 타인의 여행안 수정을 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(strangerSession)
      );

      const program = updatePlanUseCase({
        roomId: sampleRoom.id,
        plan: { ...authorPlan, title: "타참여자가 변조하려는 제목" },
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(env));

      try {
        await Effect.runPromise(program);
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 원본 보존 확인
      const check = await Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((r) => r.getRoom(sampleRoom.id)),
          Effect.provide(env)
        )
      );
      const plan = check.plans.find((p) => p.id === authorPlan.id);
      expect(plan?.title).toBe("작성자의 여행안");
      expect(check.revision).toBe(1);
    });

    it("비로그인 사용자가 수정을 시도하면 UnauthorizedError로 실패한다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(unauthenticatedSession)
      );

      try {
        await Effect.runPromise(
          updatePlanUseCase({
            roomId: sampleRoom.id,
            plan: authorPlan,
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("존재하지 않는 여행안 수정 시도 시 NotFoundError로 실패한다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      try {
        await Effect.runPromise(
          updatePlanUseCase({
            roomId: sampleRoom.id,
            plan: { ...authorPlan, id: PlanIdSchema.make("non-existent-plan") },
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail with NotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
      }
    });
  });

  describe("4. Use Case 기반 소유권 삭제 보호", () => {
    it("작성자(MEMBER)는 자신의 여행안을 정상 삭제할 수 있다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        deletePlanUseCase({
          roomId: sampleRoom.id,
          planId: authorPlan.id,
          expectedRevision: sampleRoom.revision,
        }).pipe(Effect.provide(env))
      );

      expect(res.plans.some((p) => p.id === authorPlan.id)).toBe(false);
      expect(res.plans).toHaveLength(1);
    });

    it("방장(HOST)이라도 타인의 여행안 삭제를 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(hostSession)
      );

      try {
        await Effect.runPromise(
          deletePlanUseCase({
            roomId: sampleRoom.id,
            planId: authorPlan.id,
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 원본 보존 확인
      const check = await Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((r) => r.getRoom(sampleRoom.id)),
          Effect.provide(env)
        )
      );
      expect(check.plans.some((p) => p.id === authorPlan.id)).toBe(true);
    });

    it("다른 일반 참여자(MEMBER)가 타인의 여행안 삭제를 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(strangerSession)
      );

      try {
        await Effect.runPromise(
          deletePlanUseCase({
            roomId: sampleRoom.id,
            planId: authorPlan.id,
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 원본 보존 확인
      const check = await Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((r) => r.getRoom(sampleRoom.id)),
          Effect.provide(env)
        )
      );
      expect(check.plans.some((p) => p.id === authorPlan.id)).toBe(true);
    });

    it("비로그인 사용자가 삭제를 시도하면 UnauthorizedError로 실패한다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(unauthenticatedSession)
      );

      try {
        await Effect.runPromise(
          deletePlanUseCase({
            roomId: sampleRoom.id,
            planId: authorPlan.id,
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("존재하지 않는 여행안 삭제 시도 시 NotFoundError로 실패한다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      try {
        await Effect.runPromise(
          deletePlanUseCase({
            roomId: sampleRoom.id,
            planId: PlanIdSchema.make("non-existent-plan"),
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail with NotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
      }
    });
  });

  describe("5. Local Adapter 환경 통합 검증", () => {
    beforeEach(() => {
      const storage: Record<string, string> = {};
      (globalThis as unknown as { window: { localStorage: Storage } }).window = {
        localStorage: {
          getItem: (key: string) => storage[key] ?? null,
          setItem: (key: string, val: string) => {
            storage[key] = val;
          },
          removeItem: (key: string) => {
            delete storage[key];
          },
          clear: () => {
            for (const k of Object.keys(storage)) delete storage[k];
          },
          key: (_idx: number) => null,
          length: 0,
        },
      };
    });

    it("Local 어댑터 레이어에서도 세션 기반 작성자 소유권 보호가 동일하게 동작한다", async () => {
      const localEnv = Layer.merge(
        LocalTripRoomRepositoryLayer,
        createLocalSessionLayer({
          userId: authorUser.id,
          name: authorUser.name,
          isAuthenticated: true,
        })
      );

      // 1. 방을 로컬 스토리지에 저장
      const storageKey = "galanda_rooms_v1";
      globalThis.window.localStorage.setItem(storageKey, JSON.stringify([sampleRoom]));

      // 2. 작성자가 수정 수행
      const updatedRoom = await Effect.runPromise(
        updatePlanUseCase({
          roomId: sampleRoom.id,
          plan: { ...authorPlan, title: "로컬에서 작성자가 수정한 제목" },
          expectedRevision: sampleRoom.revision,
        }).pipe(Effect.provide(localEnv))
      );

      const target = updatedRoom.plans.find((p) => p.id === authorPlan.id);
      expect(target?.title).toBe("로컬에서 작성자가 수정한 제목");
      expect(target?.authorId).toBe(authorUser.id);

      // 3. 비작성자가 수정 시도 시 UnauthorizedError로 실패
      const strangerEnv = Layer.merge(
        LocalTripRoomRepositoryLayer,
        createLocalSessionLayer({
          userId: strangerUser.id,
          name: strangerUser.name,
          isAuthenticated: true,
        })
      );

      try {
        await Effect.runPromise(
          updatePlanUseCase({
            roomId: sampleRoom.id,
            plan: { ...authorPlan, title: "이방인이 로컬 수정 시도" },
            expectedRevision: updatedRoom.revision,
          }).pipe(Effect.provide(strangerEnv))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }

      // 4. 작성자가 삭제 수행
      const afterDelete = await Effect.runPromise(
        deletePlanUseCase({
          roomId: sampleRoom.id,
          planId: authorPlan.id,
          expectedRevision: updatedRoom.revision,
        }).pipe(Effect.provide(localEnv))
      );

      expect(afterDelete.plans.some((p) => p.id === authorPlan.id)).toBe(false);
    });
  });
});
