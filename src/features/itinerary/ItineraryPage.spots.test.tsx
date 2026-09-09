// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItineraryStateResponse } from "@/contracts/itinerary.ts";
import {
  ItineraryIdSchema, ParticipantIdSchema, PlanIdSchema, RevisionSchema, TripIdSchema,
} from "@/core/domain/ids.ts";
import { useItineraryQuery } from "./queries.ts";
import { useAcknowledgeItineraryMutation } from "./mutations.ts";
import { ItineraryPage } from "./ItineraryPage.tsx";

vi.mock("./queries.ts", () => ({ useItineraryQuery: vi.fn<typeof useItineraryQuery>() }));
vi.mock("./mutations.ts", () => ({
  useAcknowledgeItineraryMutation: vi.fn<typeof useAcknowledgeItineraryMutation>(),
}));

const confirmed: ItineraryStateResponse = {
  status: "CONFIRMED",
  itinerary: {
    id: ItineraryIdSchema.make("itinerary-spot-test"),
    tripId: TripIdSchema.make("trip-spot-test"),
    sourcePlanId: PlanIdSchema.make("plan-spot-test"),
    sourcePlanRevision: RevisionSchema.make(1),
    currentRevision: RevisionSchema.make(1),
    createdBy: ParticipantIdSchema.make("host-spot-test"),
    createdAt: "2026-09-01T00:00:00.000Z",
    snapshot: { planTitle: "확정된 여행안", destination: "서울", routes: [], items: [] },
  },
  canEdit: false,
  acknowledgements: [],
  unacknowledgedCount: 0,
};

function setQuery(
  data: ItineraryStateResponse | undefined,
  overrides: Partial<ReturnType<typeof useItineraryQuery>> = {},
) {
  vi.mocked(useItineraryQuery).mockReturnValue({
    data, isLoading: false, isError: false, error: null,
    refetch: vi.fn<ReturnType<typeof useItineraryQuery>["refetch"]>(),
    ...overrides,
  } as ReturnType<typeof useItineraryQuery>);
}

function Page() {
  return (
    <MemoryRouter initialEntries={["/trips/trip-spot-test/itinerary"]}>
      <Routes>
        <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
        <Route path="/trips/:tripId/plans" element={<h1>후보 여행안 목록</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

const spot = (container: HTMLElement) => container.querySelector('[data-slot="galanda-spot"]');

beforeEach(() => {
  vi.clearAllMocks();
  setQuery({ status: "UNCONFIRMED" });
  vi.mocked(useAcknowledgeItineraryMutation).mockReturnValue({
    isPending: false, isError: false, error: null,
    reset: vi.fn<() => void>(),
    mutateAsync: vi.fn<ReturnType<typeof useAcknowledgeItineraryMutation>["mutateAsync"]>(),
  } as ReturnType<typeof useAcknowledgeItineraryMutation>);
});
afterEach(cleanup);

describe("Itinerary illustration state boundaries", () => {
  it("shows comparison rather than a success check before confirmation and preserves navigation", () => {
    const { container } = render(<Page />);
    expect(spot(container)).toHaveAttribute("data-spot", "compare-plans");
    expect(screen.getByRole("status")).toHaveTextContent("아직 확정된 일정이 없어요");
    fireEvent.click(screen.getByRole("button", { name: "후보 여행안 보러가기" }));
    expect(screen.getByRole("heading", { name: "후보 여행안 목록" })).toBeInTheDocument();
  });

  it("uses the confirmed illustration only for a confirmed itinerary without registered items", () => {
    setQuery(confirmed);
    const { container } = render(<Page />);
    expect(spot(container)).toHaveAttribute("data-spot", "confirm-plan");
    expect(screen.getByRole("status")).toHaveTextContent("등록된 확정 일정이 없어요");
    expect(screen.getByRole("status")).toHaveTextContent("숙소·교통 일정이 등록되면");
    expect(screen.queryByText(/예약 완료/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not represent missing persisted itinerary data as confirmation success", () => {
    setQuery({ status: "MISSING" });
    const { container } = render(<Page />);
    expect(spot(container)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("확정 일정 데이터가 없어요");
  });

  it("does not flash the cached confirmation illustration during loading", () => {
    setQuery(confirmed, { isLoading: true });
    const { container } = render(<Page />);
    expect(spot(container)).toBeNull();
    expect(container.querySelector('[data-system-state="loading"]')).toHaveTextContent("확정 일정을 불러오는 중");
  });

  it("preserves errors and retries instead of showing the cached confirmation illustration", () => {
    const refetch = vi.fn<ReturnType<typeof useItineraryQuery>["refetch"]>();
    setQuery(confirmed, { isError: true, error: new Error("offline"), refetch });
    const { container } = render(<Page />);
    expect(spot(container)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("일정 정보를 찾을 수 없습니다");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("does not treat an absent response as an empty or confirmed itinerary", () => {
    setQuery(undefined);
    const { container } = render(<Page />);
    expect(spot(container)).toBeNull();
    expect(container.querySelector('[data-system-state="error"]')).not.toBeNull();
  });

  it("switches from comparison to confirmation only when the query state changes", () => {
    const view = render(<Page />);
    expect(spot(view.container)).toHaveAttribute("data-spot", "compare-plans");
    setQuery(confirmed);
    view.rerender(<Page />);
    expect(view.container.querySelectorAll('[data-slot="galanda-spot"]')).toHaveLength(1);
    expect(spot(view.container)).toHaveAttribute("data-spot", "confirm-plan");
  });
});
