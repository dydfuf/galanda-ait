import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { toPlanDetailViewModel } from "../../plan-detail/plan-detail-view-model.ts";
import {
  buildConfirmPlanSummary,
  buildPlanCompareDifferences,
  canSubmitConfirm,
  getCompareConfirmState,
} from "../plan-compare-view-model.ts";

const HOST_ID = UserIdSchema.make("user-host");
const MEMBER_ID = UserIdSchema.make("user-member");

const makeRoom = (confirmedPlanId?: string): TripRoom => ({
  id: TripIdSchema.make("room-1"),
  title: "제주도 여행",
  destination: "제주도",
  startDate: "2026-09-01",
  endDate: "2026-09-04",
  revision: RevisionSchema.make(3),
  members: [
    { id: HOST_ID, name: "방장", role: "HOST" },
    { id: MEMBER_ID, name: "참여자", role: "MEMBER" },
  ],
  plans: [
    {
      id: PlanIdSchema.make("plan-basic"),
      title: "제주시 중심 3박 4일",
      status: "VOTING",
      authorId: HOST_ID,
      authorName: "방장",
      baseHeadcount: 4,
      routes: [
        { city: "제주시", nights: 2 },
        { city: "서귀포시", nights: 1 },
      ],
      accommodations: [
        {
          id: "stay-1",
          city: "서귀포시",
          period: "3일차",
          nights: 1,
          hotelName: "서귀포 리조트",
          bookingStatus: "NEED_CHECK",
          priceRange: { min: 150000, max: 190000 },
        },
      ],
      transports: [],
      places: [],
      voteCount: 0,
    },
    {
      id: PlanIdSchema.make("plan-alt"),
      title: "서귀포 호캉스",
      status: "VOTING",
      authorId: MEMBER_ID,
      authorName: "참여자",
      baseHeadcount: 4,
      routes: [],
      accommodations: [],
      transports: [],
      places: [],
      voteCount: 0,
    },
  ],
  confirmedPlanId: confirmedPlanId ? PlanIdSchema.make(confirmedPlanId) : undefined,
});

describe("비교 화면 확정 권한 상태 (RAON-143)", (): void => {
  it("방장이 보는 미확정 방은 확정 가능 상태다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), HOST_ID);

    expect(vm.isViewerHost).toBe(true);
    expect(getCompareConfirmState({ isViewerHost: vm.isViewerHost, isRoomConfirmed: false })).toEqual({
      kind: "CONFIRMABLE",
    });
  });

  it("일반 참여자에게는 확정 동작을 노출하지 않는다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), MEMBER_ID);

    expect(vm.viewerRole).toBe("MEMBER");
    expect(vm.isViewerHost).toBe(false);
    expect(getCompareConfirmState({ isViewerHost: vm.isViewerHost, isRoomConfirmed: false })).toEqual({
      kind: "VIEW_ONLY",
    });
  });

  it("방에 속하지 않은 사용자는 GUEST로 보고 확정 동작을 노출하지 않는다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), undefined);

    expect(vm.viewerRole).toBe("GUEST");
    expect(getCompareConfirmState({ isViewerHost: vm.isViewerHost, isRoomConfirmed: false })).toEqual({
      kind: "VIEW_ONLY",
    });
  });

  it("확정된 방은 방장에게도 잠금 상태이고 확정본 제목을 함께 알려준다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom("plan-basic"), HOST_ID);

    expect(
      getCompareConfirmState({
        isViewerHost: vm.isViewerHost,
        isRoomConfirmed: Boolean(vm.confirmedPlanId),
        confirmedPlanTitle: vm.confirmedPlanTitle,
      })
    ).toEqual({ kind: "LOCKED", confirmedPlanTitle: "제주시 중심 3박 4일" });
  });
});

describe("확정 요청 중복 방지 (RAON-143)", (): void => {
  it("확정 가능 상태이고 진행 중이 아닐 때만 요청한다", (): void => {
    expect(canSubmitConfirm({ state: { kind: "CONFIRMABLE" }, isPending: false })).toBe(true);
  });

  it("이미 확정 요청이 진행 중이면 추가 요청을 막는다", (): void => {
    expect(canSubmitConfirm({ state: { kind: "CONFIRMABLE" }, isPending: true })).toBe(false);
  });

  it("확정 실패 후에도 상태가 유지되어 다시 시도할 수 있다", (): void => {
    // 실패하면 mutation의 isPending이 false로 돌아오고, 방은 아직 미확정 상태다
    const state = getCompareConfirmState({ isViewerHost: true, isRoomConfirmed: false });

    expect(canSubmitConfirm({ state, isPending: false })).toBe(true);
  });

  it("방장이 아니거나 이미 확정된 방에서는 요청하지 않는다", (): void => {
    expect(canSubmitConfirm({ state: { kind: "VIEW_ONLY" }, isPending: false })).toBe(false);
    expect(canSubmitConfirm({ state: { kind: "LOCKED" }, isPending: false })).toBe(false);
  });
});

describe("확정 전 재확인 요약 (RAON-143)", (): void => {
  it("날짜·경로·총액과 확인이 필요한 예약 항목을 모아 보여준다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), HOST_ID);
    const plan = vm.plans.find((p) => p.id === "plan-basic");
    if (!plan) throw new Error("fixture에 plan-basic이 있어야 한다");

    const summary = buildConfirmPlanSummary(plan);

    expect(summary.planId).toBe("plan-basic");
    expect(summary.title).toBe("제주시 중심 3박 4일");
    expect(summary.periodText).toBe("2026-09-01 ~ 2026-09-04 · 3박 4일");
    expect(summary.routeText).toBe("제주시 2박 → 서귀포시 1박");
    expect(summary.groupCostText).toContain("그룹 총액");
    expect(summary.needCheckMessages).toHaveLength(1);
    expect(summary.needCheckMessages[0]).toContain("서귀포 리조트");
  });

  it("경로 정보가 없으면 총액을 단정하지 않고 미정으로 알린다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), HOST_ID);
    const plan = vm.plans.find((p) => p.id === "plan-alt");
    if (!plan) throw new Error("fixture에 plan-alt가 있어야 한다");

    const summary = buildConfirmPlanSummary(plan);

    expect(summary.groupCostText).toBe("예상 경비 미정");
    expect(summary.needCheckMessages).toHaveLength(0);
  });
});

describe("변경 항목 우선 비교 (RAON-166)", (): void => {
  it("일정·예약·비용 순서로 다른 행만 반환한다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), HOST_ID);
    const left = vm.plans.find((plan) => plan.id === "plan-basic");
    const right = vm.plans.find((plan) => plan.id === "plan-alt");
    if (!left || !right) throw new Error("fixture에 비교할 두 여행안이 있어야 한다");

    const differences = buildPlanCompareDifferences(left, right);

    expect(differences.map((difference) => difference.kind)).toEqual([
      "SCHEDULE",
      "BOOKING",
      "COST",
    ]);
    expect(differences.find((difference) => difference.kind === "BOOKING")?.leftValue).toContain("1건");
  });

  it("차이가 없으면 모든 항목을 접는다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), HOST_ID);
    const plan = vm.plans[0];
    if (!plan) throw new Error("fixture에 여행안이 있어야 한다");

    expect(buildPlanCompareDifferences(plan, plan)).toEqual([]);
  });

  it("비용 차이는 1인 기준 delta로 표현한다", (): void => {
    const vm = toPlanDetailViewModel(makeRoom(), HOST_ID);
    const plan = vm.plans[0];
    if (!plan) throw new Error("fixture에 여행안이 있어야 한다");

    const changedCostPlan = {
      ...plan,
      planTagLabel: "대안 1",
      costSummary: {
        ...plan.costSummary,
        minPerPerson: plan.costSummary.minPerPerson + 10000,
        maxPerPerson: plan.costSummary.maxPerPerson + 10000,
      },
    };
    const costDifference = buildPlanCompareDifferences(plan, changedCostPlan).find(
      (difference) => difference.kind === "COST"
    );

    expect(costDifference?.deltaText).toBe("1인 기준 +1만원");
  });
});
