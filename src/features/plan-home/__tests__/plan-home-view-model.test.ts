import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { getTripListStatusText, resolvePlanHomeCta, toTripRoomViewModel } from "../plan-home-view-model.ts";

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
      ],
    },
  ],
  confirmedPlanId: undefined,
};

describe("toTripRoomViewModel 진행 상태 요약 (RAON-225)", (): void => {
  it("후보 수와 의견 수, 의견 참여 인원을 실제 계산값으로 집계한다", (): void => {
    const twoPlans: TripRoom = {
      ...room,
      members: [
        ...room.members,
        { id: UserIdSchema.make("user-alice"), name: "앨리스", role: "MEMBER" },
      ],
      plans: [
        {
          ...room.plans[0],
          id: PlanIdSchema.make("plan-1"),
          memberOpinions: [
            { userId: UserIdSchema.make("user-local-me"), userName: "나", reaction: "LIKE" },
            { userId: UserIdSchema.make("user-bob"), userName: "밥", reaction: "OKAY" },
          ],
        },
        {
          ...room.plans[0],
          id: PlanIdSchema.make("plan-2"),
          memberOpinions: [
            { userId: UserIdSchema.make("user-alice"), userName: "앨리스", reaction: "HARD" },
            { userId: UserIdSchema.make("user-local-me"), userName: "나", reaction: "LIKE" },
          ],
        },
      ],
    };

    const vm = toTripRoomViewModel(twoPlans);
    expect(vm.candidateCount).toBe(2);
    expect(vm.totalOpinionCount).toBe(4);
    expect(vm.participatedMemberCount).toBe(3);
    expect(vm.isConfirmed).toBe(false);
  });

  it("수집 중 상태는 '의견 수집 중' info 배지를 표시한다", (): void => {
    const vm = toTripRoomViewModel(room);
    expect(vm.decisionBadgeText).toBe("의견 수집 중");
    expect(vm.decisionBadgeVariant).toBe("info");
  });

  it("후보가 없으면 '첫 여행안 필요' warning 배지를 표시한다", (): void => {
    const vm = toTripRoomViewModel({ ...room, plans: [] });
    expect(vm.decisionBadgeText).toBe("첫 여행안 필요");
    expect(vm.decisionBadgeVariant).toBe("warning");
    expect(vm.candidateCount).toBe(0);
    expect(vm.totalOpinionCount).toBe(0);
    expect(vm.participatedMemberCount).toBe(0);
  });

  it("확정되면 '확정됨' success 배지를 표시한다", (): void => {
    const vm = toTripRoomViewModel({ ...room, confirmedPlanId: room.plans[0].id });
    expect(vm.decisionBadgeText).toBe("확정됨");
    expect(vm.decisionBadgeVariant).toBe("success");
    expect(vm.isConfirmed).toBe(true);
  });

  it("confirmedPlanId 없이 plan.status만 CONFIRMED인 legacy 방도 확정 상태로 보호한다 (도메인 isRoomConfirmed 계약)", (): void => {
    const legacyConfirmed: TripRoom = {
      ...room,
      plans: [
        {
          ...room.plans[0],
          id: PlanIdSchema.make("plan-legacy-c"),
          status: "CONFIRMED",
        },
      ],
    };

    const vm = toTripRoomViewModel(legacyConfirmed);
    expect(vm.isConfirmed).toBe(true);
    expect(vm.decisionBadgeText).toBe("확정됨");
    expect(vm.decisionBadgeVariant).toBe("success");
    // status-only 확정에서도 어떤 안으로 확정했는지 문구가 일관되게 나온다
    expect(vm.decisionStatusText).toBe("'기본 1안'(으)로 일정을 확정했어요");
  });

  it("legacy 확정 방의 해당 플랜도 카드에서 '확정안'으로 표시된다 (도메인 isPlanConfirmed 계약)", (): void => {
    const legacyConfirmed: TripRoom = {
      ...room,
      plans: [
        { ...room.plans[0], id: PlanIdSchema.make("plan-a"), status: "DRAFT" as const },
        {
          ...room.plans[0],
          id: PlanIdSchema.make("plan-b"),
          status: "CONFIRMED",
        },
      ],
    };

    const vm = toTripRoomViewModel(legacyConfirmed);
    expect(vm.plans[1].isConfirmed).toBe(true);
    expect(vm.plans[1].planTag).toBe("CONFIRMED");
    expect(vm.plans[0].isConfirmed).toBe(false);
  });

  it("memberOpinions이 없는 legacy plan은 voteCount를 좋아요 수로 계산한다", (): void => {
    const legacyPlan = {
      id: PlanIdSchema.make("plan-legacy"),
      title: "legacy",
      status: "DRAFT" as const,
      places: [],
      voteCount: 2,
    };
    const vm = toTripRoomViewModel({ ...room, plans: [legacyPlan] });
    expect(vm.totalOpinionCount).toBe(2);
    // legacy plan에는 opinion author가 없으므로 참여자는 집계하지 않는다
    expect(vm.participatedMemberCount).toBe(0);
  });
});

describe("resolvePlanHomeCta 상태별 CTA contract (RAON-228)", (): void => {
  it.each([
    [false, 0, "create-first", "첫 여행안 만들기"],
    [false, 1, "propose-new", "새 여행안 제안하기"],
    [false, 2, "compare", "여행안 비교하기"],
    [false, 5, "compare", "여행안 비교하기"],
    [true, 0, "view-itinerary", "확정 일정 보기"],
    [true, 2, "view-itinerary", "확정 일정 보기"],
  ] as const)(
    "미확정=%s 후보=%i → primary %s (%s)",
    (isConfirmed, candidateCount, expectedKind, expectedLabel): void => {
      const cta = resolvePlanHomeCta(isConfirmed, candidateCount);
      expect(cta.primaryKind).toBe(expectedKind);
      expect(cta.primaryLabel).toBe(expectedLabel);
    },
  );

  it("primary는 상태별로 하나이며, 새 여행안 진입은 비교가 primary인 2개 이상 & 미확정에서만 secondary로 노출된다", (): void => {
    expect(resolvePlanHomeCta(false, 0).showNewProposalEntry).toBe(false);
    // 후보 1개에서는 primary 자체가 제안이므로 secondary를 겹쳐 노출하지 않는다
    expect(resolvePlanHomeCta(false, 1).showNewProposalEntry).toBe(false);
    expect(resolvePlanHomeCta(false, 2).showNewProposalEntry).toBe(true);
    expect(resolvePlanHomeCta(false, 3).showNewProposalEntry).toBe(true);
  });

  it("확정 상태에서는 허용되지 않은 mutation 진입(새 여행안/비교)을 노출하지 않는다", (): void => {
    const cta = resolvePlanHomeCta(true, 3);
    expect(cta.primaryKind).toBe("view-itinerary");
    expect(cta.showNewProposalEntry).toBe(false);
    expect(cta.primaryKind).not.toBe("compare");
    expect(cta.primaryKind).not.toBe("propose-new");
  });
});

describe("toTripRoomViewModel 세션 신원 처리 (RAON-149)", (): void => {
  it("세션 사용자의 의견만 '내 반응'으로 표시한다", (): void => {
    const vm = toTripRoomViewModel(room, UserIdSchema.make("user-local-me"));

    expect(vm.plans[0].myReaction).toBe("LIKE");
    expect(vm.plans[0].canManage).toBe(true);
  });

  it("세션 사용자가 없으면 '내 반응'과 관리 권한이 모두 비어 있다 (user-local-me 폴백 금지)", (): void => {
    const vm = toTripRoomViewModel(room, undefined);

    expect(vm.plans[0].myReaction).toBeUndefined();
    expect(vm.plans[0].isAuthor).toBe(false);
    expect(vm.plans[0].canManage).toBe(false);
  });

  it("다른 사용자의 의견은 내 반응으로 잡히지 않는다", (): void => {
    const vm = toTripRoomViewModel(room, UserIdSchema.make("user-bob"));

    expect(vm.plans[0].myReaction).toBeUndefined();
  });
});

describe("getTripListStatusText (RAON-161)", (): void => {
  it.each([
    [0, "첫 여행안을 만들어보세요"],
    [1, "여행안 1개 · 의견을 모으는 중"],
    [2, "여행안 2개 · 비교 중"],
  ])("여행안 %i개 상태를 표시한다", (planCount, expected) => {
    const plans = Array.from({ length: planCount }, (_, index) => ({
      ...room.plans[0],
      id: PlanIdSchema.make(`plan-${index + 1}`),
    }));

    expect(getTripListStatusText(toTripRoomViewModel({ ...room, plans }))).toBe(expected);
  });

  it("확정된 여행은 확정안 제목을 함께 표시한다", () => {
    const confirmedRoom = {
      ...room,
      confirmedPlanId: room.plans[0].id,
    };

    expect(getTripListStatusText(toTripRoomViewModel(confirmedRoom))).toBe(
      "일정 확정 · 기본 1안"
    );
  });

  it("미확정 방은 일정 미정, 확정 방은 확정안 날짜를 표시한다", () => {
    const datedPlan = { ...room.plans[0], routes: [{ city: "도쿄", arrivalDate: "2026-12-12", departureDate: "2026-12-17" }] };
    expect(toTripRoomViewModel({ ...room, plans: [datedPlan] }).period).toBe("일정 미정");
    expect(toTripRoomViewModel({ ...room, plans: [datedPlan], confirmedPlanId: datedPlan.id }).period).toBe("2026-12-12 ~ 2026-12-17");
  });
});

describe("toTripRoomViewModel 작성자 미확인 (RAON-153)", (): void => {
  it("authorId/authorName이 없는 legacy plan은 방장 이름으로 오표기하지 않고 '작성자 미확인'으로 표시한다", (): void => {
    const orphanPlan = {
      id: PlanIdSchema.make("plan-orphan"),
      title: "legacy",
      status: "DRAFT" as const,
      places: [],
      voteCount: 0,
    };
    const vm = toTripRoomViewModel({ ...room, plans: [orphanPlan] }, UserIdSchema.make("user-local-me"));
    expect(vm.plans[0].authorName).toBe("작성자 미확인");
    // 방장이어도 라벨은 미확인이며 관리 권한은 canManage가 별도로 결정한다
    expect(vm.plans[0].canManage).toBe(true);
    expect(vm.plans[0].isAuthor).toBe(false);
  });

  it("authorName-only legacy에서 동명이인이 2명 이상이면 '작성자 미확인'으로 표시한다", (): void => {
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
    const vm = toTripRoomViewModel(dupRoom, UserIdSchema.make("user-bob"));
    expect(vm.plans[0].authorName).toBe("작성자 미확인");
    expect(vm.plans[0].canManage).toBe(false);
  });

  it("authorName-only legacy에서 유일한 매칭 멤버가 있으면 해당 이름을 표시한다", (): void => {
    const legacyPlan = {
      id: PlanIdSchema.make("plan-legacy"),
      title: "legacy unique",
      status: "DRAFT" as const,
      authorName: "밥",
      places: [],
      voteCount: 0,
    };
    const vm = toTripRoomViewModel({ ...room, plans: [legacyPlan] }, UserIdSchema.make("user-bob"));
    expect(vm.plans[0].authorName).toBe("밥");
    expect(vm.plans[0].isAuthor).toBe(true);
  });

  it("정상 plan의 작성자 표시는 회귀하지 않는다", (): void => {
    const vm = toTripRoomViewModel(room, UserIdSchema.make("user-local-me"));
    expect(vm.plans[0].authorName).toBe("나");
    expect(vm.plans[0].isAuthor).toBe(true);
    expect(vm.plans[0].canManage).toBe(true);
  });

  it("authorId가 있지만 방에 해당 멤버가 없어도 첫 번째 멤버로 오표기하지 않는다", (): void => {
    const stalePlan = {
      id: PlanIdSchema.make("plan-stale"),
      title: "stale",
      status: "DRAFT" as const,
      authorId: UserIdSchema.make("user-ghost"),
      places: [],
      voteCount: 0,
    };
    const vm = toTripRoomViewModel({ ...room, plans: [stalePlan] }, UserIdSchema.make("user-local-me"));
    // authorId가 있으면 hasResolvable=true지만 멤버 조회 실패 시 "작성자 미확인"
    expect(vm.plans[0].authorName).toBe("작성자 미확인");
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
    // HOST가 봐도 authorName은 미확인, hasResolvable=true이므로 방장 복구 권한(!hasResolvable) 은 false
    const hostVm = toTripRoomViewModel({ ...room, plans: [stalePlan] }, UserIdSchema.make("user-local-me"));
    expect(hostVm.plans[0].authorName).toBe("작성자 미확인");
    expect(hostVm.plans[0].canManage).toBe(false);
    expect(hostVm.plans[0].isAuthor).toBe(false);

    const memberVm = toTripRoomViewModel({ ...room, plans: [stalePlan] }, UserIdSchema.make("user-bob"));
    expect(memberVm.plans[0].canManage).toBe(false);
  });
});
