import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import {
  formatNonRespondentText,
  getBookingRiskText,
  getPlanBookingNeedCheckCount,
  getPlanRouteText,
  toTripRoomViewModel,
} from "../plan-home-view-model.ts";

const member = (id: string, name: string, role: "HOST" | "MEMBER" = "MEMBER") => ({
  id: UserIdSchema.make(id),
  name,
  role,
});

const baseRoom: TripRoom = {
  id: TripIdSchema.make("room-cockpit"),
  title: "Decision Cockpit",
  destination: "제주도",
  revision: RevisionSchema.make(1),
  members: [
    member("user-host", "호스트", "HOST"),
    member("user-a", "민지"),
    member("user-b", "준호"),
    member("user-c", "서준"),
    member("user-d", "지우"),
    member("user-e", "하린"),
  ],
  plans: [],
  confirmedPlanId: undefined,
};

const planWith = (
  id: string,
  overrides: Partial<TripRoom["plans"][number]> = {},
): TripRoom["plans"][number] => ({
  id: PlanIdSchema.make(id),
  title: `${id} 여행안`,
  status: "DRAFT",
  authorId: UserIdSchema.make("user-host"),
  authorName: "호스트",
  places: [],
  voteCount: 0,
  ...overrides,
});

describe("DEC-1 Decision Cockpit view-model (RAON-293)", () => {
  it("0 후보: 참여 합집합이 0명이고 확정·위험 요약이 없다", () => {
    const vm = toTripRoomViewModel({ ...baseRoom, plans: [] });
    expect(vm.candidateCount).toBe(0);
    expect(vm.participatedMemberCount).toBe(0);
    expect(vm.overallParticipationText).toBe(
      "6명 중 0명이 한 번 이상 의견을 남겼어요",
    );
    expect(vm.overallNonRespondentNames).toHaveLength(6);
    expect(vm.totalHardCount).toBe(0);
    expect(vm.hardSummaryText).toBeUndefined();
    expect(vm.totalUnresolvedBookingCount).toBe(0);
    expect(vm.bookingSummaryText).toBeUndefined();
    expect(vm.hasUnattributedOpinions).toBe(false);
  });

  it("1 후보: 카드에서 1인 비용·예약 위험·응답률을 확인한다", () => {
    const room: TripRoom = {
      ...baseRoom,
      plans: [
        planWith("plan-1", {
          baseHeadcount: 2,
          routes: [
            { city: "도쿄", arrivalDate: "2026-12-12", departureDate: "2026-12-14" },
            { city: "오사카", arrivalDate: "2026-12-14", departureDate: "2026-12-15" },
          ],
          accommodations: [
            {
              id: "stay-1",
              city: "도쿄",
              period: "2026-12-12 ~ 2026-12-14",
              nights: 2,
              hotelName: "도쿄 호텔",
              bookingStatus: "NEED_CHECK",
              priceRange: { min: 200_000, max: 200_000 },
            },
          ],
          transports: [],
          memberOpinions: [
            { userId: UserIdSchema.make("user-host"), userName: "호스트", reaction: "LIKE" },
            { userId: UserIdSchema.make("user-a"), userName: "민지", reaction: "OKAY" },
          ],
        }),
      ],
    };
    const vm = toTripRoomViewModel(room);
    expect(vm.overallParticipationText).toBe(
      "6명 중 2명이 한 번 이상 의견을 남겼어요",
    );
    const plan = vm.plans[0];
    expect(plan.routeText).toBe("도쿄 2박 · 오사카 1박");
    expect(plan.perPersonCostText).toBe("2명 기준 1인 10만원");
    expect(plan.bookingNeedCheckCount).toBe(1);
    expect(plan.bookingRiskText).toBe("확인 필요 1건");
    expect(plan.responseText).toBe("이 여행안에 2/6명 응답");
    expect(plan.nonRespondentNames).toEqual(["준호", "서준", "지우", "하린"]);
    expect(plan.nonRespondentText).toBe(
      "준호, 서준님 외 2명은 아직 의견이 없어요",
    );
    expect(vm.totalUnresolvedBookingCount).toBe(1);
    expect(vm.bookingSummaryText).toBe("예약 확인 필요 1건");
  });

  it("2 후보: 전체 합집합과 후보별 응답률을 혼동하지 않는다", () => {
    const room: TripRoom = {
      ...baseRoom,
      plans: [
        planWith("plan-1", {
          memberOpinions: [
            { userId: UserIdSchema.make("user-host"), userName: "호스트", reaction: "LIKE" },
            { userId: UserIdSchema.make("user-a"), userName: "민지", reaction: "LIKE" },
          ],
        }),
        planWith("plan-2", {
          memberOpinions: [
            { userId: UserIdSchema.make("user-b"), userName: "준호", reaction: "HARD" },
          ],
        }),
      ],
    };
    const vm = toTripRoomViewModel(room);
    // 합집합 3명, 후보별은 2/6과 1/6으로 다르다
    expect(vm.participatedMemberCount).toBe(3);
    expect(vm.overallParticipationText).toBe(
      "6명 중 3명이 한 번 이상 의견을 남겼어요",
    );
    expect(vm.plans[0].responseText).toBe("이 여행안에 2/6명 응답");
    expect(vm.plans[1].responseText).toBe("이 여행안에 1/6명 응답");
    expect(vm.totalHardCount).toBe(1);
    expect(vm.hardAffectedCandidateCount).toBe(1);
    expect(vm.hardSummaryText).toBe("어려워요 1개 · 1개 여행안에서 확인 필요");
  });

  it("3+ 후보: 어려운 의견과 미응답자를 상단 요약에서 확인한다", () => {
    const room: TripRoom = {
      ...baseRoom,
      plans: [
        planWith("plan-1", {
          memberOpinions: [
            { userId: UserIdSchema.make("user-host"), userName: "호스트", reaction: "LIKE" },
          ],
        }),
        planWith("plan-2", {
          memberOpinions: [
            { userId: UserIdSchema.make("user-a"), userName: "민지", reaction: "HARD" },
            { userId: UserIdSchema.make("user-b"), userName: "준호", reaction: "HARD" },
          ],
        }),
        planWith("plan-3", { memberOpinions: [] }),
      ],
    };
    const vm = toTripRoomViewModel(room);
    expect(vm.candidateCount).toBe(3);
    expect(vm.totalHardCount).toBe(2);
    expect(vm.hardAffectedCandidateCount).toBe(1);
    expect(vm.overallNonRespondentText).toContain("아직 의견이 없어요");
    expect(vm.overallNonRespondentNames).toEqual(["서준", "지우", "하린"]);
  });

  it("확정 상태에서도 응답·비용·예약 위험을 그대로 파생한다", () => {
    const confirmedPlan = planWith("plan-1", {
      status: "CONFIRMED",
      baseHeadcount: 2,
      accommodations: [
        {
          id: "stay-1",
          city: "도쿄",
          period: "2026-12-12 ~ 2026-12-14",
          nights: 2,
          hotelName: "도쿄 호텔",
          bookingStatus: "AVAILABLE",
          priceRange: { min: 100_000, max: 100_000 },
        },
      ],
      memberOpinions: [
        { userId: UserIdSchema.make("user-host"), userName: "호스트", reaction: "LIKE" },
      ],
    });
    const room: TripRoom = {
      ...baseRoom,
      plans: [confirmedPlan],
      confirmedPlanId: confirmedPlan.id,
    };
    const vm = toTripRoomViewModel(room);
    expect(vm.isConfirmed).toBe(true);
    expect(vm.decisionBadgeText).toBe("확정됨");
    expect(vm.plans[0].isConfirmed).toBe(true);
    expect(vm.plans[0].perPersonCostText).toBe("2명 기준 1인 5만원");
    expect(vm.plans[0].bookingRiskText).toBe("예약 확인 완료");
    expect(vm.plans[0].responseText).toBe("이 여행안에 1/6명 응답");
  });

  it("비용 미입력은 0원이 아니라 비용 미정으로 표시하고 명시적 0원과 구분한다", () => {
    const unknownRoom: TripRoom = {
      ...baseRoom,
      plans: [
        planWith("plan-unknown", {
          accommodations: [
            {
              id: "stay-1",
              city: "도쿄",
              period: "2026-12-12 ~ 2026-12-14",
              nights: 2,
              hotelName: "미정",
              bookingStatus: "NOT_CHECKED",
            },
          ],
        }),
      ],
    };
    expect(toTripRoomViewModel(unknownRoom).plans[0].perPersonCostText).toBe(
      "비용 미정",
    );

    const zeroRoom: TripRoom = {
      ...baseRoom,
      plans: [
        planWith("plan-zero", {
          baseHeadcount: 2,
          accommodations: [
            {
              id: "stay-1",
              city: "도쿄",
              period: "2026-12-12 ~ 2026-12-14",
              nights: 2,
              hotelName: "게스트하우스",
              bookingStatus: "AVAILABLE",
              priceRange: { min: 0, max: 0 },
            },
          ],
        }),
      ],
    };
    expect(toTripRoomViewModel(zeroRoom).plans[0].perPersonCostText).toBe(
      "2명 기준 1인 0원",
    );
  });

  it("레거시 비귀속 의견은 총 의견 수에만 포함하고 응답률에서는 제외하며 설명한다", () => {
    const room: TripRoom = {
      ...baseRoom,
      plans: [
        {
          id: PlanIdSchema.make("plan-legacy"),
          title: "legacy",
          status: "DRAFT",
          places: [],
          voteCount: 5,
        },
        planWith("plan-new", {
          memberOpinions: [
            { userId: UserIdSchema.make("user-host"), userName: "호스트", reaction: "LIKE" },
            { userId: UserIdSchema.make("user-ghost"), userName: "탈퇴", reaction: "LIKE" },
          ],
        }),
      ],
    };
    const vm = toTripRoomViewModel(room);
    // 총 7개(레거시 5 + 구조화 2)지만 응답률은 현재 멤버 1명만
    expect(vm.totalOpinionCount).toBe(7);
    expect(vm.participatedMemberCount).toBe(1);
    expect(vm.hasUnattributedOpinions).toBe(true);
    expect(vm.unattributedOpinionCount).toBe(6);
    expect(vm.unattributedNoticeText).toBe(
      "과거 의견 6개는 회원과 연결되지 않아 응답률에서 제외했어요",
    );
    expect(vm.overallParticipationText).toBe(
      "6명 중 1명이 한 번 이상 의견을 남겼어요",
    );
  });

  it("탈퇴 멤버 의견만으로는 참여율을 올리지 않는다", () => {
    const room: TripRoom = {
      ...baseRoom,
      plans: [
        planWith("plan-1", {
          memberOpinions: [
            { userId: UserIdSchema.make("user-ghost"), userName: "탈퇴", reaction: "LIKE" },
          ],
        }),
      ],
    };
    const vm = toTripRoomViewModel(room);
    expect(vm.totalOpinionCount).toBe(1);
    expect(vm.participatedMemberCount).toBe(0);
    expect(vm.plans[0].respondentCount).toBe(0);
    expect(vm.plans[0].responseText).toBe("이 여행안에 0/6명 응답");
  });

  it("긴 이름도 의미를 잃지 않고 요약된다", () => {
    const longName = `아주 긴 이름 ${"가".repeat(50)}`;
    expect(formatNonRespondentText([longName])).toBe(
      `${longName}님은 아직 의견이 없어요`,
    );
    expect(
      formatNonRespondentText(["a", "b", "c", "d"]),
    ).toBe("a, b님 외 2명은 아직 의견이 없어요");
    expect(formatNonRespondentText([])).toBeUndefined();
  });

  it("경로·예약 헬퍼는 입력 provenance를 유지한다", () => {
    expect(getPlanRouteText({ routes: undefined })).toBe("경로 미정");
    expect(
      getPlanRouteText({
        routes: [
          { city: "도쿄", arrivalDate: "2026-12-12", departureDate: "2026-12-14" },
        ],
      }),
    ).toBe("도쿄 2박");
    expect(getBookingRiskText(0, false)).toBe("예약 정보 없음");
    expect(getBookingRiskText(0, true)).toBe("예약 확인 완료");
    expect(getBookingRiskText(2, true)).toBe("확인 필요 2건");
    expect(
      getPlanBookingNeedCheckCount({
        accommodations: [
          {
            id: "s1",
            city: "도쿄",
            period: "p",
            nights: 1,
            hotelName: "",
            isSearching: true,
            bookingStatus: "AVAILABLE",
          },
        ],
        transports: [{ id: "t1", fromCity: "a", toCity: "b", mode: "m", hasTransfer: false, durationText: "d", bookingStatus: "AVAILABLE" }],
      }),
    ).toBe(1);
  });
});
