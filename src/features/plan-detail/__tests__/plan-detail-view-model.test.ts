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
  startDate: "2026-09-01",
  endDate: "2026-09-05",
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
            { city: "도쿄", nights: 1 },
            { city: "하코네", nights: 1 },
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
