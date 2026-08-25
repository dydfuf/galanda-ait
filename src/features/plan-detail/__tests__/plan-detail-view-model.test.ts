import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { toPlanDetailViewModel } from "../plan-detail-view-model.ts";

/**
 * 로컬 기본 사용자(user-local-me)의 의견이 이미 존재하는 방
 * - 세션이 확인되지 않을 때 이 의견이 "내 의견"으로 오인되면 안 된다
 */
const room: TripRoom = {
  id: TripIdSchema.make("room-1"),
  title: "제주도 힐링 여행",
  destination: "제주도",
  revision: RevisionSchema.make(1),
  members: [
    { id: UserIdSchema.make("user-local-me"), name: "나", role: "HOST" },
    { id: UserIdSchema.make("user-bob"), name: "밥", role: "MEMBER" },
  ],
  plans: [
    {
      id: PlanIdSchema.make("plan-1"),
      title: "기본 1안",
      status: "DRAFT",
      authorId: UserIdSchema.make("user-local-me"),
      authorName: "나",
      places: [],
      voteCount: 0,
      memberOpinions: [
        {
          userId: UserIdSchema.make("user-local-me"),
          userName: "나",
          reaction: "LIKE",
        },
        {
          userId: UserIdSchema.make("user-bob"),
          userName: "밥",
          reaction: "HARD",
          reason: "이동이 너무 많아요",
        },
      ],
    },
  ],
  confirmedPlanId: undefined,
};

describe("toPlanDetailViewModel 세션 신원 처리 (RAON-149)", (): void => {
  it("세션 사용자의 의견만 '내 의견'으로 표시한다", (): void => {
    const vm = toPlanDetailViewModel(room, UserIdSchema.make("user-bob"));
    const plan = vm.plans[0];

    expect(plan.myReaction).toBe("HARD");
    expect(plan.myOpinionReason).toBe("이동이 너무 많아요");
    expect(plan.memberOpinions).toEqual([
      { userId: "user-local-me", userName: "나", reaction: "LIKE" },
      { userId: "user-bob", userName: "밥", reaction: "HARD" },
    ]);
    expect("reason" in (plan.memberOpinions[1] ?? {})).toBe(false);
  });

  it("세션 사용자가 없으면 '내 의견'이 존재하지 않는다 (user-local-me 폴백 금지)", (): void => {
    const vm = toPlanDetailViewModel(room, undefined);
    const plan = vm.plans[0];

    expect(plan.myReaction).toBeUndefined();
    expect(plan.myOpinionReason).toBeUndefined();
  });

  it("세션 사용자가 없으면 여행안 관리 권한도 부여되지 않는다", (): void => {
    const vm = toPlanDetailViewModel(room, undefined);
    const plan = vm.plans[0];

    expect(plan.isAuthor).toBe(false);
    expect(plan.canManage).toBe(false);
  });

  it("확정된 방에서는 작성자의 미확정 여행안 관리 CTA도 잠근다", (): void => {
    const confirmedPlan = {
      ...room.plans[0],
      id: PlanIdSchema.make("plan-confirmed"),
      title: "확정안",
      status: "CONFIRMED" as const,
    };
    const lockedRoom = {
      ...room,
      plans: [room.plans[0], confirmedPlan],
      confirmedPlanId: confirmedPlan.id,
    };

    const plan = toPlanDetailViewModel(
      lockedRoom,
      UserIdSchema.make("user-local-me")
    ).plans[0];

    expect(plan.isConfirmed).toBe(false);
    expect(plan.isAuthor).toBe(true);
    expect(plan.canManage).toBe(false);
  });

  it("의견을 남기지 않은 사용자에게는 다른 사람의 사유가 노출되지 않는다", (): void => {
    const vm = toPlanDetailViewModel(room, UserIdSchema.make("user-stranger"));
    const plan = vm.plans[0];

    expect(plan.myReaction).toBeUndefined();
    expect(plan.myOpinionReason).toBeUndefined();
    // 목록 자체는 그대로 유지된다
    expect(plan.memberOpinions).toHaveLength(2);
  });

  it.each(["FULL", "NEED_CHECK", "NOT_CHECKED"] as const)(
    "숙소가 없어도 교통 상태(%s)를 예약 위험으로 집계한다",
    (bookingStatus): void => {
    const roomWithTransport: TripRoom = {
      ...room,
      plans: [
        {
          ...room.plans[0],
          routes: [
            { city: "도쿄", arrivalDate: "2026-09-01", departureDate: "2026-09-02" },
            { city: "하코네", arrivalDate: "2026-09-02", departureDate: "2026-09-03" },
          ],
          transports: [
            {
              id: "transport-1",
              fromCity: "도쿄",
              toCity: "하코네",
              mode: "기차",
              hasTransfer: false,
              durationText: "약 1시간",
              bookingStatus,
            },
          ],
        },
      ],
    };

    const plan = toPlanDetailViewModel(roomWithTransport, undefined).plans[0];

    expect(plan.timelineItems).toHaveLength(1);
    expect(plan.timelineItems[0]?.type).toBe("TRANSPORT");
    expect(plan.timelineItems[0]?.transport?.bookingStatus).toBe(
      bookingStatus === "NOT_CHECKED" ? "SEARCHING" : bookingStatus
    );
    expect(plan.bookingRisks).toHaveLength(1);
    expect(plan.bookingRisks[0]?.message).toContain("도쿄 → 하코네");
    expect(plan.bookingRisks[0]?.level).toBe(bookingStatus === "FULL" ? "DANGER" : "WARNING");
    }
  );
});

describe("toPlanDetailViewModel 작성자 미확인 (RAON-153)", (): void => {
  it("author 정보가 없는 legacy plan은 '작성자 미확인'으로 표시하고 방장만 관리 가능하다", (): void => {
    const orphanPlan = {
      id: PlanIdSchema.make("plan-orphan"),
      title: "legacy",
      status: "DRAFT" as const,
      places: [],
      voteCount: 0,
    };
    const roomWithOrphan: TripRoom = {
      ...room,
      plans: [orphanPlan],
    };
    const hostVm = toPlanDetailViewModel(roomWithOrphan, UserIdSchema.make("user-local-me"));
    expect(hostVm.plans[0].authorName).toBe("작성자 미확인");
    expect(hostVm.plans[0].canManage).toBe(true);
    expect(hostVm.plans[0].isAuthor).toBe(false);

    const memberVm = toPlanDetailViewModel(roomWithOrphan, UserIdSchema.make("user-bob"));
    expect(memberVm.plans[0].authorName).toBe("작성자 미확인");
    expect(memberVm.plans[0].canManage).toBe(false);
  });

  it("동명이인 legacy는 '작성자 미확인'으로 표시하고 일반 멤버는 관리 불가", (): void => {
    const dupRoom: TripRoom = {
      ...room,
      members: [
        ...room.members,
        { id: UserIdSchema.make("user-alice2"), name: "밥", role: "MEMBER" },
      ],
      plans: [
        {
          id: PlanIdSchema.make("plan-legacy"),
          title: "legacy dup",
          status: "DRAFT",
          authorName: "밥",
          places: [],
          voteCount: 0,
        },
      ],
    };
    const vm = toPlanDetailViewModel(dupRoom, UserIdSchema.make("user-bob"));
    expect(vm.plans[0].authorName).toBe("작성자 미확인");
    expect(vm.plans[0].canManage).toBe(false);
  });

  it("정상 plan은 작성자 표시가 유지되고 canManage와 모순되지 않는다", (): void => {
    const vm = toPlanDetailViewModel(room, UserIdSchema.make("user-local-me"));
    const plan = vm.plans[0];
    expect(plan.authorName).toBe("나");
    expect(plan.isAuthor).toBe(true);
    expect(plan.canManage).toBe(true);
  });

  it("stale authorId(탈퇴 멤버)인 경우 UI는 미확인이지만 방장 복구 권한은 열리지 않는다 — ID ownership은 영구 신뢰", (): void => {
    const stalePlan = {
      id: PlanIdSchema.make("plan-stale"),
      title: "stale",
      status: "DRAFT" as const,
      authorId: UserIdSchema.make("user-ghost"),
      places: [],
      voteCount: 0,
    };
    const roomWithStale: TripRoom = { ...room, plans: [stalePlan] };
    const hostVm = toPlanDetailViewModel(roomWithStale, UserIdSchema.make("user-local-me"));
    expect(hostVm.plans[0].authorName).toBe("작성자 미확인");
    expect(hostVm.plans[0].canManage).toBe(false);
    expect(hostVm.plans[0].isAuthor).toBe(false);

    const memberVm = toPlanDetailViewModel(roomWithStale, UserIdSchema.make("user-bob"));
    expect(memberVm.plans[0].canManage).toBe(false);
  });
});
