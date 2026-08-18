import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { toTripRoomViewModel } from "../plan-home-view-model.ts";

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
      ],
    },
  ],
  confirmedPlanId: undefined,
};

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
