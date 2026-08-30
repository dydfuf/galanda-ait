import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { getRoomActor } from "../../../core/domain/auth-guards.ts";
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

const PROPERTY_5_SEED = 0x5afe_095;
const PROPERTY_5_CASE_COUNT = 128;

interface PlanProvenanceCase {
  readonly plans: TripRoom["plans"];
}

function createDeterministicGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generatePlanProvenanceCase(
  caseIndex: number,
  next: () => number,
): PlanProvenanceCase {
  const planCount = caseIndex % 9;
  const plans: TripRoom["plans"] = Array.from(
    { length: planCount },
    (_, planIndex) => {
      const optionalVariant = (caseIndex + planIndex) % 4;
      const member = room.members[Math.floor(next() * room.members.length)];
      const month = String((planIndex % 9) + 1).padStart(2, "0");

      return {
        id: PlanIdSchema.make(`property-5-plan-${caseIndex}-${planIndex}`),
        title: `사용자가 입력한 여행안 ${caseIndex}-${planIndex}-${Math.floor(next() * 1_000_000)}`,
        status: "DRAFT" as const,
        places: [],
        voteCount: Math.floor(next() * 20),
        ...(optionalVariant === 1 || optionalVariant === 3
          ? {
              differenceSummary: `사용자가 입력한 핵심 차이 ${caseIndex}-${planIndex}`,
            }
          : {}),
        ...(optionalVariant === 2 || optionalVariant === 3
          ? { authorId: member.id, authorName: member.name }
          : {}),
        ...(optionalVariant === 3
          ? {
              routes: [
                {
                  city: `도시 ${caseIndex}-${planIndex}`,
                  arrivalDate: `2027-${month}-01`,
                  departureDate: `2027-${month}-03`,
                },
              ],
            }
          : {}),
      };
    },
  );

  return { plans };
}

function formatPlanProvenanceCounterexample(
  caseIndex: number,
  planCase: PlanProvenanceCase,
): string {
  return [
    `Property 5 counterexample (seed=0x${PROPERTY_5_SEED.toString(16)}, case=${caseIndex})`,
    JSON.stringify(
      planCase.plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        differenceSummary: plan.differenceSummary,
        authorId: plan.authorId,
        authorName: plan.authorName,
        routes: plan.routes,
      })),
    ),
  ].join(", ");
}

function assertWithCounterexample(
  counterexample: string,
  assertion: () => void,
): void {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${counterexample}\n${error.message}`;
    }
    throw error;
  }
}

describe("Plan Home view-model entity provenance", (): void => {
  // **Validates: Requirements 4.1, 9.12, 11.5**
  it("Feature: toss-liquid-glass-ui-refresh, Property 5: View-Model Entity Provenance", (): void => {
    const next = createDeterministicGenerator(PROPERTY_5_SEED);

    for (let caseIndex = 0; caseIndex < PROPERTY_5_CASE_COUNT; caseIndex += 1) {
      const planCase = generatePlanProvenanceCase(caseIndex, next);
      const counterexample = formatPlanProvenanceCounterexample(
        caseIndex,
        planCase,
      );
      const projected = toTripRoomViewModel({
        ...room,
        plans: planCase.plans,
        confirmedPlanId: undefined,
      });

      assertWithCounterexample(counterexample, () => {
        expect(projected.plans).toHaveLength(planCase.plans.length);
        expect(projected.plans.map(({ id, title }) => ({ id, title }))).toEqual(
          planCase.plans.map(({ id, title }) => ({ id, title })),
        );

        planCase.plans.forEach((sourcePlan, planIndex) => {
          const projectedPlan = projected.plans[planIndex];

          expect(projectedPlan.id).toBe(sourcePlan.id);
          expect(projectedPlan.title).toBe(sourcePlan.title);
          expect(projectedPlan.differenceSummary).toBe(
            sourcePlan.differenceSummary,
          );
          expect(projectedPlan.differenceSummaryText).toBe(
            sourcePlan.differenceSummary ?? "핵심 차이 미정",
          );
          expect(projectedPlan.authorName).toBe(
            sourcePlan.authorName ?? "작성자 미확인",
          );

          const sourceRoute = sourcePlan.routes?.[0];
          expect(projectedPlan.period).toBe(
            sourceRoute
              ? `${sourceRoute.arrivalDate} ~ ${sourceRoute.departureDate}`
              : "일정 미정",
          );
        });
      });
    }
  });
});

describe("toTripRoomViewModel 진행 상태 요약 (RAON-225)", (): void => {
  it("후보 수와 의견 수, 의견 참여 인원을 실제 계산값으로 집계한다", (): void => {
    const twoPlans: TripRoom = {
      ...room,
      members: [
        ...room.members,
        {
          id: UserIdSchema.make("user-alice"),
          name: "앨리스, 여행자",
          role: "MEMBER",
        },
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
    expect(vm.memberNames).toContain("앨리스, 여행자");
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

  it("legacy voteCount와 구조화 의견이 섞이면 참여자 미상 상태를 보존한다", (): void => {
    const legacyPlan = {
      id: PlanIdSchema.make("plan-legacy"),
      title: "legacy",
      status: "DRAFT" as const,
      places: [],
      voteCount: 2,
    };
    const structuredPlan = {
      ...room.plans[0],
      id: PlanIdSchema.make("plan-structured"),
      memberOpinions: [
        {
          userId: UserIdSchema.make("user-local-me"),
          userName: "나",
          reaction: "LIKE" as const,
        },
      ],
    };
    const vm = toTripRoomViewModel({
      ...room,
      plans: [legacyPlan, structuredPlan],
    });

    expect(vm.totalOpinionCount).toBe(3);
    expect(vm.participatedMemberCount).toBe(1);
    expect(vm.hasUnattributedOpinions).toBe(true);
  });

  it("source 여행안 순서와 제목을 보존하고 누락된 핵심 차이를 미정으로 표시한다", (): void => {
    const plans: TripRoom["plans"] = [
      {
        ...room.plans[0],
        id: PlanIdSchema.make("plan-first"),
        title: "입력한 첫 번째 제목",
        differenceSummary: "입력한 핵심 차이",
      },
      {
        ...room.plans[0],
        id: PlanIdSchema.make("plan-second"),
        title: "입력한 두 번째 제목",
        differenceSummary: undefined,
      },
    ];

    const vm = toTripRoomViewModel({ ...room, plans });

    expect(vm.plans.map(({ id, title }) => ({ id, title }))).toEqual(
      plans.map(({ id, title }) => ({ id, title })),
    );
    expect(
      vm.plans.map(({ differenceSummaryText }) => differenceSummaryText),
    ).toEqual(["입력한 핵심 차이", "핵심 차이 미정"]);
  });
});

describe("resolvePlanHomeCta 상태별 CTA contract (RAON-228)", (): void => {
  const resolveCta = (
    candidateCount: number,
    participantId = UserIdSchema.make("user-local-me"),
    confirmed = false,
  ) => {
    const plans = Array.from({ length: candidateCount }, (_, index) => ({
      ...room.plans[0],
      id: PlanIdSchema.make(`plan-${index + 1}`),
    }));
    const targetRoom: TripRoom = {
      ...room,
      plans,
      confirmedPlanId: confirmed ? plans[0]?.id : undefined,
    };

    return resolvePlanHomeCta(
      targetRoom,
      getRoomActor(targetRoom, participantId),
    );
  };

  it.each([
    [false, 0, "create-first", "첫 여행안 만들기"],
    [false, 1, "propose-new", "새 여행안 제안하기"],
    [false, 2, "compare", "여행안 비교하기"],
    [false, 5, "compare", "여행안 비교하기"],
    [true, 2, "view-itinerary", "확정 일정 보기"],
  ] as const)(
    "확정=%s 후보=%i → primary %s (%s)",
    (confirmed, candidateCount, expectedKind, expectedLabel): void => {
      const cta = resolveCta(candidateCount, UserIdSchema.make("user-local-me"), confirmed);
      expect(cta.primaryKind).toBe(expectedKind);
      expect(cta.primaryLabel).toBe(expectedLabel);
    },
  );

  it("plan:create 가능자(HOST/MEMBER)는 새 여행안 진입을 비교가 primary인 2개 이상 & 미확정에서만 secondary로 노출한다", (): void => {
    expect(resolveCta(0).showNewProposalEntry).toBe(false);
    // 후보 1개에서는 primary 자체가 제안이므로 secondary를 겹쳐 노출하지 않는다
    expect(resolveCta(1).showNewProposalEntry).toBe(false);
    expect(resolveCta(2).showNewProposalEntry).toBe(true);
    expect(resolveCta(3).showNewProposalEntry).toBe(true);
  });

  it("확정 상태에서는 허용되지 않은 mutation 진입(새 여행안/비교)을 노출하지 않는다", (): void => {
    const cta = resolveCta(3, UserIdSchema.make("user-local-me"), true);
    expect(cta.primaryKind).toBe("view-itinerary");
    expect(cta.showNewProposalEntry).toBe(false);
    expect(cta.primaryKind).not.toBe("compare");
    expect(cta.primaryKind).not.toBe("propose-new");
  });

  it("GUEST(plan:create 없음)에게 mutation CTA(첫 여행안 만들기/새 여행안 제안하기)를 노출하지 않는다 (RBAC 계약)", (): void => {
    for (const candidateCount of [0, 1]) {
      const cta = resolveCta(candidateCount, UserIdSchema.make("guest"));
      expect(cta.primaryKind).toBeNull();
      expect(cta.primaryLabel).toBeNull();
      expect(cta.showNewProposalEntry).toBe(false);
    }
  });

  it("GUEST + 후보 2개 이상에도 recommendation을 노출하지 않는다", (): void => {
    const cta = resolveCta(3, UserIdSchema.make("guest"));
    expect(cta.primaryKind).toBeNull();
    expect(cta.primaryLabel).toBeNull();
    expect(cta.showNewProposalEntry).toBe(false);
  });

  it("GUEST + 확정 상태에도 itinerary recommendation을 노출하지 않는다", (): void => {
    const cta = resolveCta(2, UserIdSchema.make("guest"), true);
    expect(cta.primaryKind).toBeNull();
    expect(cta.primaryLabel).toBeNull();
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
