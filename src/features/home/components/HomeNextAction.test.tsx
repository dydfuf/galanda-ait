// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/app/api-client.ts";
import { RecommendNextActionResponseSchema } from "@/contracts/recommendation.ts";
import { TripRoomSchema, UserSessionSchema } from "@/core/domain/room.ts";
import { Schema } from "effect";
import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { useNextTripActionRecommendation } from "@/features/common/use-next-trip-action-recommendation.ts";
import { HomeNextAction } from "./HomeNextAction.tsx";

vi.mock("@/hooks/useSession.ts", () => ({ useSessionQuery: vi.fn<typeof useSessionQuery>() }));
vi.mock("@/features/common/use-next-trip-action-recommendation.ts", () => ({ useNextTripActionRecommendation: vi.fn<typeof useNextTripActionRecommendation>() }));

const session = Schema.decodeUnknownSync(UserSessionSchema)({ participantId: "member", participantIds: ["member", "old-member"], name: "멤버", accountType: "GUEST", isAuthenticated: true });
const room = Schema.decodeUnknownSync(TripRoomSchema)({
  id: "trip", title: "여행", destination: "서울", revision: 2,
  members: [{ id: "member", name: "멤버", role: "MEMBER" }],
  plans: [
    { id: "first", title: "첫 안", status: "VOTING", places: [], voteCount: 1, memberOpinions: [{ userId: "old-member", userName: "이전 이름", reaction: "LIKE" }] },
    { id: "second", title: "다음 안", status: "VOTING", places: [], voteCount: 0 },
  ],
});
const recommendation = Schema.decodeUnknownSync(RecommendNextActionResponseSchema)({
  recommendationId: "rec-1", primary: { actionId: "GIVE_OPINION", reasonCode: "SHARE_PLAN_OPINION" },
  alternatives: [], source: "RULE", policyVersion: "nba-rule-v1", tripRevision: 2, contextFingerprint: "a".repeat(64),
});
const trip: TripOverviewDto = {
  id: "trip", title: "여행", destination: "서울", revision: 2, isConfirmed: false, confirmedPeriod: null,
  memberCount: 1, memberNames: ["멤버"], candidateCount: 2, opinionParticipantCount: 1,
  hasUnattributedOpinions: false, createdAt: "2026-09-01", updatedAt: "2026-09-01", eligibleActionIds: ["GIVE_OPINION"],
};
const Destination = () => <p>{useLocation().pathname}</p>;
const renderAction = (value = trip) => render(<MemoryRouter initialEntries={["/home"]}><Routes>
  <Route path="/home" element={<HomeNextAction trip={value} />} />
  <Route path="/trips/:tripId/plans/:planId" element={<Destination />} />
</Routes></MemoryRouter>);

beforeEach(() => {
  vi.mocked(useSessionQuery).mockReturnValue({ data: session } as ReturnType<typeof useSessionQuery>);
  vi.mocked(useNextTripActionRecommendation).mockReturnValue({ data: recommendation, isPending: false } as ReturnType<typeof useNextTripActionRecommendation>);
  vi.spyOn(api, "getTrip").mockResolvedValue(room);
  vi.spyOn(api, "recordRecommendationLifecycleEvent").mockResolvedValue({ accepted: true });
});
afterEach(() => vi.restoreAllMocks());

describe("HOME next action", () => {
  it("HOME surface를 재사용하고 실제 세션의 미응답 안을 연다", async () => {
    renderAction();
    expect(useNextTripActionRecommendation).toHaveBeenCalledWith("trip", { surface: "HOME" }, 2, true);
    fireEvent.click(screen.getByRole("button", { name: "여행안에 의견 남기기" }));
    expect(await screen.findByText("/trips/trip/plans/second")).toBeInTheDocument();
  });
  it("overview와 일치하지 않는 권한 action은 표시하지 않는다", () => {
    renderAction({ ...trip, eligibleActionIds: [] });
    expect(screen.queryByRole("button", { name: "여행안에 의견 남기기" })).not.toBeInTheDocument();
  });
  it("클릭 전에 방이 확정되면 오래된 의견 action을 실행하지 않는다", async () => {
    vi.mocked(api.getTrip).mockResolvedValue({ ...room, confirmedPlanId: room.plans[0].id });
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "여행안에 의견 남기기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("여행 상태가 바뀌었어요");
    expect(screen.queryByText("/trips/trip/plans/second")).not.toBeInTheDocument();
  });
});
