import { Effect } from "effect";
import type { PlanId, UserId } from "./ids.ts";
import type { TripMember, TripPlan, TripRoom } from "./room.ts";
import { NotFoundError, UnauthorizedError } from "./errors.ts";

/**
 * 여행방에서의 사용자 역할
 * - HOST: 방장 (방 관리, 확정, 수정, 삭제 등 모든 권한)
 * - MEMBER: 정식 참여자 (여행안 제안, 수정, 투표, 의견 제출 등)
 * - GUEST: 비로그인/초대장 열람자 (조회 및 참여 요청만 가능)
 */
export type RoomRole = "HOST" | "MEMBER" | "GUEST";

/**
 * 여행방에서 수행 가능한 도메인 액션(권한)
 */
export type RoomAction =
  | "room:view"        // 방 기본 정보 및 여행안 열람
  | "room:join"        // 방 참여 (MEMBER 등록)
  | "room:update"      // 방 설정(제목, 일정, 목적지) 수정 (HOST 전용)
  | "room:delete"      // 방 삭제 (HOST 전용)
  | "room:invite"      // 초대 링크 발급/공유
  | "plan:create"      // 새 여행안 제안/생성
  | "plan:update"      // 여행안 수정
  | "plan:delete"      // 여행안 삭제
  | "plan:confirm"     // 여행안 최종 확정
  | "opinion:submit";  // 의견 및 투표 제출

/**
 * 역할별 기본 권한 매트릭스 (RBAC Policy)
 */
export const ROLE_PERMISSIONS: Record<RoomRole, ReadonlySet<RoomAction>> = {
  HOST: new Set<RoomAction>([
    "room:view",
    "room:join",
    "room:update",
    "room:delete",
    "room:invite",
    "plan:create",
    "plan:update",
    "plan:delete",
    "plan:confirm",
    "opinion:submit",
  ]),
  MEMBER: new Set<RoomAction>([
    "room:view",
    "room:join",
    "room:invite",
    "plan:create",
    "plan:update",
    "plan:delete",
    "plan:confirm",
    "opinion:submit",
  ]),
  GUEST: new Set<RoomAction>([
    "room:view",
    "room:join",
  ]),
};

/**
 * 특정 방에서의 사용자 권한 컨텍스트 객체
 */
export interface RoomActor {
  readonly member?: TripMember;
  readonly role: RoomRole;
  readonly isHost: boolean;
  readonly isMember: boolean;
  readonly isGuest: boolean;
  readonly can: (action: RoomAction) => boolean;
}

/**
 * 사용자의 역할 및 권한 정보를 담은 RoomActor 획득
 * - 멤버 목록에 존재하지 않거나 userId가 없으면 GUEST(열람자) 역할 부여
 */
export const getRoomActor = (
  room: TripRoom,
  userId?: UserId
): RoomActor => {
  const member = userId ? room.members.find((m) => m.id === userId) : undefined;
  let role: RoomRole = "GUEST";

  if (member) {
    role = member.role === "HOST" ? "HOST" : "MEMBER";
  }

  const permissions = ROLE_PERMISSIONS[role];

  return {
    member,
    role,
    isHost: role === "HOST",
    isMember: role === "MEMBER" || role === "HOST",
    isGuest: role === "GUEST",
    can: (action: RoomAction) => permissions.has(action),
  };
};

/**
 * 특정 액션 수행 권한을 검증하는 RBAC 가드
 */
export const requireRoomPermission = (
  room: TripRoom,
  userId: UserId | undefined,
  action: RoomAction,
  customReason?: string
): Effect.Effect<RoomActor, UnauthorizedError> =>
  Effect.gen(function* () {
    const actor = getRoomActor(room, userId);

    if (!actor.can(action)) {
      let defaultReason = "해당 작업을 수행할 권한이 없습니다.";
      if (actor.isGuest) {
        defaultReason = "여행방 참여자만 이용할 수 있는 기능입니다. 먼저 방에 참여해주세요.";
      } else if (!actor.isHost) {
        defaultReason = "방장만 이 작업을 수행할 수 있습니다.";
      }

      return yield* Effect.fail(
        new UnauthorizedError({ reason: customReason ?? defaultReason })
      );
    }

    return actor;
  });

/**
 * 특정 역할(예: HOST, MEMBER)을 직접 요구하는 가드
 */
export const requireRoomRole = (
  room: TripRoom,
  userId: UserId,
  allowedRoles: ReadonlyArray<RoomRole>,
  reason = "해당 작업을 수행할 수 있는 권한이 없습니다."
): Effect.Effect<RoomActor, UnauthorizedError> =>
  Effect.gen(function* () {
    const actor = getRoomActor(room, userId);
    if (!allowedRoles.includes(actor.role)) {
      return yield* Effect.fail(new UnauthorizedError({ reason }));
    }
    return actor;
  });

/**
 * 특정 사용자가 방의 정식 멤버인지 검증하고 멤버 정보를 반환하는 가드
 */
export const requireRoomMember = (
  room: TripRoom,
  userId: UserId,
  reason = "여행방 참여자만 접근할 수 있습니다."
): Effect.Effect<TripMember, UnauthorizedError> =>
  Effect.gen(function* () {
    const actor = yield* requireRoomPermission(room, userId, "opinion:submit", reason);
    if (!actor.member) {
      return yield* Effect.fail(new UnauthorizedError({ reason }));
    }
    return actor.member;
  });

/**
 * 특정 사용자가 방의 호스트(방장)인지 검증하는 가드
 */
export const requireRoomHost = (
  room: TripRoom,
  userId: UserId,
  reason = "방장만 이 작업을 수행할 수 있습니다."
): Effect.Effect<TripMember, UnauthorizedError> =>
  Effect.gen(function* () {
    const actor = yield* requireRoomRole(room, userId, ["HOST"], reason);
    if (!actor.member) {
      return yield* Effect.fail(new UnauthorizedError({ reason }));
    }
    return actor.member;
  });

/**
 * 특정 여행안이 방에 존재하는지 검증하고 해당 플랜을 반환하는 가드
 */
export const requirePlanInRoom = (
  room: TripRoom,
  planId: PlanId
): Effect.Effect<TripPlan, NotFoundError> => {
  const plan = room.plans.find((p) => p.id === planId);
  if (!plan) {
    return Effect.fail(new NotFoundError({ entity: "TripPlan", id: planId }));
  }
  return Effect.succeed(plan);
};

/**
 * 여행안 작성자 또는 방장 권한을 요구하는 가드 (소유권 기반 ABAC)
 * - authorId가 존재하면 userId와 직접 비교
 * - legacy/이전 데이터로 인해 authorId가 누락된 경우:
 *   authorName과 일치하는 방 참여자가 유일(단 1명)할 때만 해당 참여자를 작성자로 인정
 *   동명이인이 존재하거나 일치하는 멤버가 없으면 일반 멤버는 소유권을 주장할 수 없으며 방장만 수정/삭제 가능
 */
export const requirePlanAuthorOrHost = (
  room: TripRoom,
  plan: TripPlan,
  userId: UserId,
  reason = "여행안 작성자 또는 방장만 수정/삭제할 수 있습니다."
): Effect.Effect<RoomActor, UnauthorizedError> =>
  Effect.gen(function* () {
    const actor = getRoomActor(room, userId);
    let isAuthor = false;

    if (plan.authorId !== undefined) {
      isAuthor = plan.authorId === userId;
    } else if (plan.authorName) {
      const matchingMembers = room.members.filter(
        (m) => m.name === plan.authorName
      );
      if (matchingMembers.length === 1 && matchingMembers[0].id === userId) {
        isAuthor = true;
      }
    }

    if (!isAuthor && !actor.isHost) {
      return yield* Effect.fail(new UnauthorizedError({ reason }));
    }

    return actor;
  });
