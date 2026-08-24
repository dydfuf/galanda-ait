import { describe, expect, it, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
  type Revision,
  type TripId,
} from "../../domain/ids.ts";
import type { TripMember, TripPlan, TripRoom, UserSession } from "../../domain/room.ts";
import { SessionService } from "../../ports/session.ts";
import { TripRoomRepository } from "../../ports/trip-room-repository.ts";
import { createPlan, updatePlan, deletePlan } from "../save-plan.ts";
import { createTripRoom } from "../create-room.ts";
import {
  isPlanAuthor,
  isPlanConfirmed,
  requireMutablePlan,
  requirePlanAuthor,
  hasResolvablePlanAuthor,
  canManagePlan,
} from "../../domain/auth-guards.ts";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  RepositoryError,
} from "../../domain/errors.ts";
import { LocalTripRoomRepositoryLayer } from "../../../infrastructure/local/local-trip-room-repo.ts";
import { createLocalSessionLayer } from "../../../infrastructure/local/local-session.ts";
import { IdGeneratorLive } from "../../../infrastructure/id-generator.ts";
import type { IdGenerator } from "../../ports/id-generator.ts";

/**
 * 인메모리 테스트 레포지토리
 */
const createInMemoryRepo = (
  initialRooms: TripRoom[]
): Layer.Layer<TripRoomRepository> => {
  let rooms = [...initialRooms];

  return Layer.succeed(TripRoomRepository, {
    getRoom: (roomId: TripId): Effect.Effect<TripRoom, NotFoundError> => {
      const found = rooms.find((r) => r.id === roomId);
      if (!found) {
        return Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId }));
      }
      return Effect.succeed(found);
    },
    getRooms: (): Effect.Effect<ReadonlyArray<TripRoom>, never> => Effect.succeed(rooms),
    createRoom: (): Effect.Effect<TripRoom, never> => Effect.die("not implemented in test"),
    updateRoom: (): Effect.Effect<TripRoom, never> => Effect.die("not implemented in test"),
    createPlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
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
    updatePlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
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
    saveRoom: (
      nextRoom: TripRoom,
      expectedRevision: Revision
    ): Effect.Effect<TripRoom, NotFoundError | ConflictError> => {
      const idx = rooms.findIndex((room) => room.id === nextRoom.id);
      if (idx === -1) {
        return Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: nextRoom.id })
        );
      }
      if (rooms[idx].revision !== expectedRevision) {
        return Effect.fail(new ConflictError({ message: "conflict", expectedRevision, actualRevision: rooms[idx].revision }));
      }
      const updated: TripRoom = {
        ...nextRoom,
        revision: RevisionSchema.make(expectedRevision + 1),
      };
      rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
      return Effect.succeed(updated);
    },
  });
};

const createSessionLayer = (
  session: UserSession
): Layer.Layer<SessionService | IdGenerator> =>
  Layer.merge(
    Layer.succeed(SessionService, {
      getCurrentSession: (): Effect.Effect<UserSession, never> =>
        Effect.succeed(session),
      getCurrentUser: (): Effect.Effect<UserSession, UnauthorizedError> =>
        session.isAuthenticated
          ? Effect.succeed(session)
          : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
    }),
    IdGeneratorLive
  );

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
    revision: RevisionSchema.make(1),
    members: [hostUser, authorUser, strangerUser],
    plans: [hostPlan, authorPlan],
    confirmedPlanId: undefined,
  };

  const hostSession: UserSession = {
    participantId: hostUser.id,
    participantIds: [hostUser.id],
    accountType: "REGISTERED",
    name: hostUser.name,
    isAuthenticated: true,
  };

  const authorSession: UserSession = {
    participantId: authorUser.id,
    participantIds: [authorUser.id],
    accountType: "REGISTERED",
    name: authorUser.name,
    isAuthenticated: true,
  };

  const strangerSession: UserSession = {
    participantId: strangerUser.id,
    participantIds: [strangerUser.id],
    accountType: "REGISTERED",
    name: strangerUser.name,
    isAuthenticated: true,
  };

  const unauthenticatedSession: UserSession = {
    participantId: UserIdSchema.make("user-anonymous"),
    participantIds: [UserIdSchema.make("user-anonymous")],
    accountType: "GUEST",
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

    it("작성자를 식별할 수 없는 레거시 여행안(authorName 미기재, 불일치, 동명이인)의 경우 방장에게만 canManagePlan/requirePlanAuthor가 허용되어 영구 잠금을 방지한다", async () => {
      const roomWithDuplicates: TripRoom = {
        ...sampleRoom,
        members: [
          ...sampleRoom.members,
          { id: UserIdSchema.make("user-author-2"), name: "작성자", role: "MEMBER" },
        ],
      };
      const ambiguousPlan: TripPlan = {
        id: PlanIdSchema.make("plan-legacy-ambiguous"),
        title: "동명이인 레거시 플랜",
        status: "DRAFT",
        authorName: "작성자",
        places: [],
        voteCount: 0,
      };
      const orphanPlan: TripPlan = {
        id: PlanIdSchema.make("plan-legacy-orphan"),
        title: "작성자 정보 없는 레거시 플랜",
        status: "DRAFT",
        places: [],
        voteCount: 0,
      };

      expect(hasResolvablePlanAuthor(roomWithDuplicates, ambiguousPlan)).toBe(false);
      expect(hasResolvablePlanAuthor(sampleRoom, orphanPlan)).toBe(false);

      // 일반 멤버(작성자 포함 동명이인)에게는 canManagePlan이 false
      expect(canManagePlan(roomWithDuplicates, ambiguousPlan, authorUser.id)).toBe(false);
      expect(canManagePlan(sampleRoom, orphanPlan, authorUser.id)).toBe(false);

      // 방장에게는 canManagePlan이 true
      expect(canManagePlan(roomWithDuplicates, ambiguousPlan, hostUser.id)).toBe(true);
      expect(canManagePlan(sampleRoom, orphanPlan, hostUser.id)).toBe(true);

      // requirePlanAuthor 가드: 방장은 통과, 일반 멤버는 실패
      const hostSuccess = await Effect.runPromise(
        requirePlanAuthor(roomWithDuplicates, ambiguousPlan, hostUser.id)
      );
      expect(hostSuccess.isHost).toBe(true);

      try {
        await Effect.runPromise(
          requirePlanAuthor(roomWithDuplicates, ambiguousPlan, authorUser.id)
        );
        expect.unreachable("member should fail on ambiguous legacy plan");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });
  });

  describe("2. Use Case 기반 플랜 생성 시 작성자 지정", () => {
    it("createPlan은 세션 사용자를 작성자로 등록한다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        createPlan({
          roomId: sampleRoom.id,
          title: "신규 제안",
          places: [],
          expectedRevision: sampleRoom.revision,
        }).pipe(Effect.provide(env))
      );

      const created = res.plans.find((p) => p.title === "신규 제안");
      expect(created?.authorId).toBe(authorUser.id);
      expect(created?.authorName).toBe(authorUser.name);
      expect(created?.status).toBe("VOTING");
      expect(created?.revision).toBe(1);
      expect(Date.parse(created?.publishedAt ?? "")).not.toBeNaN();
      expect(created?.memberOpinions).toEqual([]);
      expect(created?.voteCount).toBe(0);
    });

    it("clone은 현재 세션 작성자와 새 서버 소유 상태로 생성된다", async () => {
      const sourcePlan: TripPlan = {
        ...hostPlan,
        status: "CONFIRMED",
        memberOpinions: [{
          userId: authorUser.id,
          userName: authorUser.name,
          reaction: "LIKE",
        }],
        voteCount: 1,
      };
      const room = { ...sampleRoom, plans: [sourcePlan] };
      const env = Layer.merge(
        createInMemoryRepo([room]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        createPlan({
          roomId: room.id,
          title: "복제한 대안",
          places: [],
          cloneFromPlanId: sourcePlan.id,
          expectedRevision: room.revision,
        }).pipe(Effect.provide(env))
      );

      const clone = res.plans.find((p) => p.title === "복제한 대안");
      expect(clone?.id).not.toBe(sourcePlan.id);
      expect(clone?.authorId).toBe(authorUser.id);
      expect(clone?.status).toBe("VOTING");
      expect(clone?.revision).toBe(1);
      expect(clone?.memberOpinions).toEqual([]);
      expect(clone?.voteCount).toBe(0);
      expect(clone?.clonedFromPlanId).toBe(sourcePlan.id);
    });
  });

  describe("3. Use Case 기반 소유권 수정 보호", () => {
    it("작성자(MEMBER)는 자신의 여행안을 정상 수정할 수 있다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        updatePlan({
          roomId: sampleRoom.id,
          plan: { ...authorPlan, title: "작성자가 수정한 제목" },
          expectedRevision: sampleRoom.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === authorPlan.id);
      expect(target?.title).toBe("작성자가 수정한 제목");
      expect(target?.authorId).toBe(authorUser.id);
      expect(target?.status).toBe("VOTING");
      expect(target?.revision).toBe(2);
      expect(Date.parse(target?.publishedAt ?? "")).not.toBeNaN();
    });

    it("방장(HOST)이라도 타인의 여행안 수정을 시도하면 UnauthorizedError로 실패하고 원본이 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(hostSession)
      );

      const program = updatePlan({
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

      const program = updatePlan({
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
          updatePlan({
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
          updatePlan({
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

    it("작성자를 식별할 수 없는 레거시 여행안을 방장이 수정할 수 있어 영구 잠금이 방지된다", async () => {
      const orphanPlan: TripPlan = {
        id: PlanIdSchema.make("plan-orphan"),
        title: "작성자 정보가 유실된 플랜",
        status: "DRAFT",
        places: [],
        voteCount: 0,
      };
      const roomWithOrphan: TripRoom = {
        ...sampleRoom,
        plans: [...sampleRoom.plans, orphanPlan],
      };

      const env = Layer.merge(
        createInMemoryRepo([roomWithOrphan]),
        createSessionLayer(hostSession)
      );

      const res = await Effect.runPromise(
        updatePlan({
          roomId: roomWithOrphan.id,
          plan: { ...orphanPlan, title: "방장이 수정한 레거시 플랜" },
          expectedRevision: roomWithOrphan.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === orphanPlan.id);
      expect(target?.title).toBe("방장이 수정한 레거시 플랜");
    });
  });

  describe("4. Use Case 기반 소유권 삭제 보호", () => {
    it("작성자(MEMBER)는 자신의 여행안을 정상 삭제할 수 있다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([sampleRoom]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        deletePlan({
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
          deletePlan({
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
          deletePlan({
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
          deletePlan({
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
          deletePlan({
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

    it("작성자를 식별할 수 없는 레거시 여행안을 방장이 삭제할 수 있어 영구 잠금이 방지된다", async () => {
      const orphanPlan: TripPlan = {
        id: PlanIdSchema.make("plan-orphan"),
        title: "작성자 정보가 유실된 플랜",
        status: "DRAFT",
        places: [],
        voteCount: 0,
      };
      const roomWithOrphan: TripRoom = {
        ...sampleRoom,
        plans: [...sampleRoom.plans, orphanPlan],
      };

      const env = Layer.merge(
        createInMemoryRepo([roomWithOrphan]),
        createSessionLayer(hostSession)
      );

      const res = await Effect.runPromise(
        deletePlan({
          roomId: roomWithOrphan.id,
          planId: orphanPlan.id,
          expectedRevision: roomWithOrphan.revision,
        }).pipe(Effect.provide(env))
      );

      expect(res.plans.some((p) => p.id === orphanPlan.id)).toBe(false);
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
          participantId: authorUser.id,
          participantIds: [authorUser.id],
          accountType: "REGISTERED",
          name: authorUser.name,
          isAuthenticated: true,
        })
      );

      // 1. 방을 로컬 스토리지에 저장
      const storageKey = "galanda_rooms_v1";
      globalThis.window.localStorage.setItem(storageKey, JSON.stringify([sampleRoom]));

      // 2. 작성자가 수정 수행
      const updatedRoom = await Effect.runPromise(
        updatePlan({
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
          participantId: strangerUser.id,
          participantIds: [strangerUser.id],
          accountType: "REGISTERED",
          name: strangerUser.name,
          isAuthenticated: true,
        })
      );

      try {
        await Effect.runPromise(
          updatePlan({
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
        deletePlan({
          roomId: sampleRoom.id,
          planId: authorPlan.id,
          expectedRevision: updatedRoom.revision,
        }).pipe(Effect.provide(localEnv))
      );

      expect(afterDelete.plans.some((p) => p.id === authorPlan.id)).toBe(false);
    });

    it("localStorage 저장 실패 시(스토리지 차단/용량 초과 등) 성공으로 위장하지 않고 에러를 전파한다", async () => {
      const localEnv = Layer.merge(
        LocalTripRoomRepositoryLayer,
        createLocalSessionLayer({
          participantId: authorUser.id,
          participantIds: [authorUser.id],
          accountType: "REGISTERED",
          name: authorUser.name,
          isAuthenticated: true,
        })
      );

      const storageKey = "galanda_rooms_v1";
      globalThis.window.localStorage.setItem(storageKey, JSON.stringify([sampleRoom]));

      // setItem이 에러(용량 초과/접근 제한)를 던지도록 모킹
      globalThis.window.localStorage.setItem = () => {
        throw new Error("QuotaExceededError: storage is full");
      };

      try {
        await Effect.runPromise(
          updatePlan({
            roomId: sampleRoom.id,
            plan: { ...authorPlan, title: "스토리지 오류 시도" },
            expectedRevision: sampleRoom.revision,
          }).pipe(Effect.provide(localEnv))
        );
        expect.unreachable("should fail when localStorage fails");
      } catch (err) {
        expect(err).toBeInstanceOf(RepositoryError);
      }
    });

    it("방 생성 시 localStorage 저장 실패 시 NotFoundError(id: storage)가 아닌 RepositoryError를 전파한다", async () => {
      const localEnv = Layer.merge(
        Layer.merge(
          LocalTripRoomRepositoryLayer,
          createLocalSessionLayer({
            participantId: hostUser.id,
            participantIds: [hostUser.id],
            accountType: "REGISTERED",
            name: hostUser.name,
            isAuthenticated: true,
          })
        ),
        IdGeneratorLive
      );

      // setItem이 에러(용량 초과/접근 제한)를 던지도록 모킹
      globalThis.window.localStorage.setItem = () => {
        throw new Error("QuotaExceededError: storage is full");
      };

      try {
        await Effect.runPromise(
          createTripRoom({
            title: "신규 방 생성 시도",
          }).pipe(Effect.provide(localEnv))
        );
        expect.unreachable("should fail when localStorage fails on room creation");
      } catch (err) {
        expect(err).toBeInstanceOf(RepositoryError);
        expect((err as RepositoryError).message).toContain("QuotaExceededError: storage is full");
      }
    });
  });

  describe("6. RAON-150: 서버 소유 필드 보호 및 확정본 불변성", () => {
    const opinionsPlan: TripPlan = {
      id: PlanIdSchema.make("plan-with-opinions"),
      title: "의견이 모인 여행안",
      status: "VOTING",
      authorId: authorUser.id,
      authorName: authorUser.name,
      places: [],
      voteCount: 2,
      memberOpinions: [
        { userId: hostUser.id, userName: hostUser.name, reaction: "LIKE" },
        {
          userId: strangerUser.id,
          userName: strangerUser.name,
          reaction: "LIKE",
          reason: "이 안이 좋아요",
        },
      ],
    };

    const roomWithOpinions: TripRoom = {
      ...sampleRoom,
      plans: [hostPlan, opinionsPlan],
    };

    const confirmedPlan: TripPlan = {
      ...opinionsPlan,
      id: PlanIdSchema.make("plan-confirmed"),
      title: "확정된 여행안",
      status: "CONFIRMED",
    };

    const roomWithConfirmed: TripRoom = {
      ...sampleRoom,
      plans: [hostPlan, confirmedPlan],
      confirmedPlanId: confirmedPlan.id,
    };

    const readRoom = (
      env: Layer.Layer<TripRoomRepository | SessionService>,
      roomId: TripId
    ): Promise<TripRoom> =>
      Effect.runPromise(
        TripRoomRepository.pipe(
          Effect.flatMap((r) => r.getRoom(roomId)),
          Effect.provide(env)
        )
      );

    it("작성자의 수정 요청이라도 타인의 의견과 투표수를 덮어쓸 수 없다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithOpinions]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        updatePlan({
          roomId: roomWithOpinions.id,
          plan: {
            ...opinionsPlan,
            title: "작성자가 수정한 제목",
            memberOpinions: [],
            voteCount: 99,
          },
          expectedRevision: roomWithOpinions.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === opinionsPlan.id);
      expect(target?.title).toBe("작성자가 수정한 제목");
      expect(target?.memberOpinions).toEqual(opinionsPlan.memberOpinions);
      expect(target?.voteCount).toBe(2);
    });

    it("작성자의 수정 요청으로 status를 확정으로 위조할 수 없다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithOpinions]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        updatePlan({
          roomId: roomWithOpinions.id,
          plan: { ...opinionsPlan, status: "CONFIRMED" },
          expectedRevision: roomWithOpinions.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === opinionsPlan.id);
      expect(target?.status).toBe("VOTING");
      expect(res.confirmedPlanId).toBeUndefined();
    });

    it("작성자의 수정 요청으로 복제 계보(clonedFromPlanId)를 바꿀 수 없다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithOpinions]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        updatePlan({
          roomId: roomWithOpinions.id,
          plan: { ...opinionsPlan, clonedFromPlanId: hostPlan.id },
          expectedRevision: roomWithOpinions.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === opinionsPlan.id);
      expect(target?.clonedFromPlanId).toBeUndefined();
    });

    it("작성자가 편집하는 내용은 그대로 반영된다 (과보호 회귀 방지 대조군)", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithOpinions]),
        createSessionLayer(authorSession)
      );

      const res = await Effect.runPromise(
        updatePlan({
          roomId: roomWithOpinions.id,
          plan: {
            ...opinionsPlan,
            title: "  공백이 정리된 제목  ",
            proposalReason: "숙소를 바꿨어요",
            baseHeadcount: 5,
            routes: [{ city: "서귀포", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
          },
          expectedRevision: roomWithOpinions.revision,
        }).pipe(Effect.provide(env))
      );

      const target = res.plans.find((p) => p.id === opinionsPlan.id);
      expect(target?.title).toBe("공백이 정리된 제목");
      expect(target?.proposalReason).toBe("숙소를 바꿨어요");
      expect(target?.baseHeadcount).toBe(5);
      expect(target?.routes).toEqual([{ city: "서귀포", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }]);
      expect(target?.memberOpinions).toEqual([]);
      expect(target?.voteCount).toBe(0);
    });

    it("확정된 여행안은 작성자도 수정할 수 없고 원본이 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithConfirmed]),
        createSessionLayer(authorSession)
      );

      try {
        await Effect.runPromise(
          updatePlan({
            roomId: roomWithConfirmed.id,
            plan: { ...confirmedPlan, title: "확정본을 바꾸려는 제목" },
            expectedRevision: roomWithConfirmed.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect((err as UnauthorizedError).reason).toContain(
          "확정된 여행안은 수정할 수 없습니다."
        );
      }

      const check = await readRoom(env, roomWithConfirmed.id);
      const plan = check.plans.find((p) => p.id === confirmedPlan.id);
      expect(plan?.title).toBe("확정된 여행안");
      expect(check.revision).toBe(1);
    });

    it("확정된 여행안은 작성자도 삭제할 수 없고 방의 확정 상태가 보존된다", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithConfirmed]),
        createSessionLayer(authorSession)
      );

      try {
        await Effect.runPromise(
          deletePlan({
            roomId: roomWithConfirmed.id,
            planId: confirmedPlan.id,
            expectedRevision: roomWithConfirmed.revision,
          }).pipe(Effect.provide(env))
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect((err as UnauthorizedError).reason).toContain(
          "확정된 여행안은 삭제할 수 없습니다."
        );
      }

      const check = await readRoom(env, roomWithConfirmed.id);
      expect(check.plans.some((p) => p.id === confirmedPlan.id)).toBe(true);
      expect(check.confirmedPlanId).toBe(confirmedPlan.id);
      expect(check.revision).toBe(1);
    });

    it("status가 확정이 아니어도 방의 confirmedPlanId가 가리키는 여행안은 변경할 수 없다", async () => {
      // 확정 신호가 어긋난 레거시 데이터 (room.confirmedPlanId만 확정을 가리키는 경우)
      const staleStatusPlan: TripPlan = { ...opinionsPlan, status: "VOTING" };
      const roomWithStaleStatus: TripRoom = {
        ...sampleRoom,
        plans: [hostPlan, staleStatusPlan],
        confirmedPlanId: staleStatusPlan.id,
      };

      expect(isPlanConfirmed(roomWithStaleStatus, staleStatusPlan)).toBe(true);
      expect(isPlanConfirmed(roomWithOpinions, opinionsPlan)).toBe(false);

      const env = Layer.merge(
        createInMemoryRepo([roomWithStaleStatus]),
        createSessionLayer(authorSession)
      );

      for (const program of [
        updatePlan({
          roomId: roomWithStaleStatus.id,
          plan: { ...staleStatusPlan, title: "확정본을 바꾸려는 제목" },
          expectedRevision: roomWithStaleStatus.revision,
        }),
        deletePlan({
          roomId: roomWithStaleStatus.id,
          planId: staleStatusPlan.id,
          expectedRevision: roomWithStaleStatus.revision,
        }),
      ]) {
        try {
          await Effect.runPromise(program.pipe(Effect.provide(env)));
          expect.unreachable("should fail");
        } catch (err) {
          expect(err).toBeInstanceOf(UnauthorizedError);
        }
      }

      const check = await readRoom(env, roomWithStaleStatus.id);
      expect(check.plans.find((p) => p.id === staleStatusPlan.id)?.title).toBe(
        "의견이 모인 여행안"
      );
      expect(check.revision).toBe(1);
    });

    it("requireMutablePlan 가드는 미확정 여행안만 통과시킨다", async () => {
      await Effect.runPromise(requireMutablePlan(roomWithOpinions, opinionsPlan));

      try {
        await Effect.runPromise(
          requireMutablePlan(roomWithConfirmed, confirmedPlan)
        );
        expect.unreachable("should fail");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("미확정 여행안의 정상 수정·삭제 경로는 유지된다 (회귀 방지 대조군)", async () => {
      const env = Layer.merge(
        createInMemoryRepo([roomWithOpinions]),
        createSessionLayer(authorSession)
      );

      const updated = await Effect.runPromise(
        updatePlan({
          roomId: roomWithOpinions.id,
          plan: { ...opinionsPlan, title: "미확정 여행안 수정" },
          expectedRevision: roomWithOpinions.revision,
        }).pipe(Effect.provide(env))
      );
      expect(
        updated.plans.find((p) => p.id === opinionsPlan.id)?.title
      ).toBe("미확정 여행안 수정");

      const afterDelete = await Effect.runPromise(
        deletePlan({
          roomId: roomWithOpinions.id,
          planId: opinionsPlan.id,
          expectedRevision: updated.revision,
        }).pipe(Effect.provide(env))
      );
      expect(afterDelete.plans.some((p) => p.id === opinionsPlan.id)).toBe(false);
    });

    describe("Local 어댑터 동일성", () => {
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

      it("Local 어댑터에서도 확정본 수정·삭제가 거부되고 저장소 내용이 그대로 유지된다", async () => {
        const localEnv = Layer.merge(
          LocalTripRoomRepositoryLayer,
          createLocalSessionLayer({
            participantId: authorUser.id,
            participantIds: [authorUser.id],
            accountType: "REGISTERED",
            name: authorUser.name,
            isAuthenticated: true,
          })
        );

        const storageKey = "galanda_rooms_v1";
        const initialSnapshot = JSON.stringify([roomWithConfirmed]);
        globalThis.window.localStorage.setItem(storageKey, initialSnapshot);

        try {
          await Effect.runPromise(
            updatePlan({
              roomId: roomWithConfirmed.id,
              plan: { ...confirmedPlan, title: "로컬에서 확정본 수정 시도" },
              expectedRevision: roomWithConfirmed.revision,
            }).pipe(Effect.provide(localEnv))
          );
          expect.unreachable("should fail");
        } catch (err) {
          expect(err).toBeInstanceOf(UnauthorizedError);
        }

        try {
          await Effect.runPromise(
            deletePlan({
              roomId: roomWithConfirmed.id,
              planId: confirmedPlan.id,
              expectedRevision: roomWithConfirmed.revision,
            }).pipe(Effect.provide(localEnv))
          );
          expect.unreachable("should fail");
        } catch (err) {
          expect(err).toBeInstanceOf(UnauthorizedError);
        }

        expect(globalThis.window.localStorage.getItem(storageKey)).toBe(
          initialSnapshot
        );
      });

      it("Local 어댑터에서도 수정 요청이 타인의 의견과 투표수를 덮어쓸 수 없다", async () => {
        const localEnv = Layer.merge(
          LocalTripRoomRepositoryLayer,
          createLocalSessionLayer({
            participantId: authorUser.id,
            participantIds: [authorUser.id],
            accountType: "REGISTERED",
            name: authorUser.name,
            isAuthenticated: true,
          })
        );

        const storageKey = "galanda_rooms_v1";
        globalThis.window.localStorage.setItem(
          storageKey,
          JSON.stringify([roomWithOpinions])
        );

        const res = await Effect.runPromise(
          updatePlan({
            roomId: roomWithOpinions.id,
            plan: {
              ...opinionsPlan,
              title: "로컬에서 의견을 지우려는 수정",
              memberOpinions: [],
              voteCount: 0,
            },
            expectedRevision: roomWithOpinions.revision,
          }).pipe(Effect.provide(localEnv))
        );

        const target = res.plans.find((p) => p.id === opinionsPlan.id);
        expect(target?.title).toBe("로컬에서 의견을 지우려는 수정");
        expect(target?.memberOpinions).toEqual(opinionsPlan.memberOpinions);
        expect(target?.voteCount).toBe(2);
      });
    });
  });
});
