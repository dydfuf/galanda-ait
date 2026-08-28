// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { ApiClientError } from "../../app/api-client.ts";
import type { ConfirmedItinerary } from "../../core/domain/confirmed-itinerary.ts";
import {
  ItineraryIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";

vi.mock("./queries.ts", () => ({
  useItineraryQuery: vi.fn(),
}));
vi.mock("./mutations.ts", () => ({
  useReviseItineraryMutation: vi.fn(),
}));

import { ItineraryEditPage } from "./ItineraryEditPage.tsx";
import { useReviseItineraryMutation } from "./mutations.ts";
import { useItineraryQuery } from "./queries.ts";

const mockUseItineraryQuery = vi.mocked(useItineraryQuery);
const mockUseReviseItineraryMutation = vi.mocked(
  useReviseItineraryMutation,
);

const TRIP_ID = "trip-itinerary-edit";
const EDIT_PATH = `/trips/${TRIP_ID}/itinerary/edit`;
const LONG_HOTEL_NAME =
  "https://example.com/very/long/hotel/name/that/must/remain/fully/editable 도쿄 장기 숙소";

const itinerary: ConfirmedItinerary = {
  id: ItineraryIdSchema.make("itinerary-edit"),
  tripId: TripIdSchema.make(TRIP_ID),
  sourcePlanId: PlanIdSchema.make("plan-source"),
  sourcePlanRevision: RevisionSchema.make(3),
  currentRevision: RevisionSchema.make(4),
  createdBy: ParticipantIdSchema.make("participant-host"),
  createdAt: "2026-08-24T00:00:00.000Z",
  snapshot: {
    planTitle: "도쿄 일정",
    destination: "일본",
    routes: [
      {
        city: "도쿄",
        arrivalDate: "2026-12-10",
        departureDate: "2026-12-13",
      },
    ],
    items: [
      {
        type: "STAY",
        date: "2026-12-10",
        endDate: "2026-12-13",
        memo: "기존 숙소 메모",
        accommodation: {
          id: "stay-tokyo",
          city: "도쿄",
          period: "12.10 ~ 12.13",
          nights: 3,
          hotelName: "도쿄 호텔",
          bookingStatus: "AVAILABLE",
        },
      },
      {
        type: "TRANSPORT",
        date: "2026-12-10",
        memo: "기존 이동 메모",
        transport: {
          id: "flight-out",
          fromCity: "서울",
          toCity: "도쿄",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE",
        },
      },
    ],
  },
};

const confirmedState = (value: ConfirmedItinerary = itinerary) => ({
  status: "CONFIRMED" as const,
  itinerary: value,
  canEdit: true,
  acknowledgements: [],
  unacknowledgedCount: 0,
});

const queryResult = (
  value: ConfirmedItinerary = itinerary,
  refetch = vi.fn(),
): ReturnType<typeof useItineraryQuery> =>
  ({
    data: confirmedState(value),
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  }) as unknown as ReturnType<typeof useItineraryQuery>;

const mutationResult = (
  mutateAsync = vi.fn(),
  isPending = false,
): ReturnType<typeof useReviseItineraryMutation> =>
  ({
    mutateAsync,
    isPending,
  }) as unknown as ReturnType<typeof useReviseItineraryMutation>;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={[EDIT_PATH]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/trips/:tripId/itinerary/edit"
          element={<ItineraryEditPage />}
        />
        <Route path="*" element={<div>이동 완료</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = () => render(<TestApp />);

beforeEach(() => {
  mockUseItineraryQuery.mockReset();
  mockUseReviseItineraryMutation.mockReset();
  mockUseItineraryQuery.mockReturnValue(queryResult());
  mockUseReviseItineraryMutation.mockReturnValue(mutationResult());
});

describe("ItineraryEditPage shared form presentation", () => {
  it("opaque fieldset, permanent label, responsive field layout, validation accessory를 제공한다", () => {
    const { container } = renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "확정 일정 수정" }),
    ).toBeInTheDocument();
    expect(screen.getByText("수정 기준 v4 · 저장하면 새 revision이 생성됩니다.")).toBeInTheDocument();

    const stayGroup = screen.getByRole("group", { name: "숙소 일정 1" });
    const transportGroup = screen.getByRole("group", {
      name: "이동 일정 2",
    });
    expect(stayGroup.className).toContain("bg-surface-content");
    expect(stayGroup.className).toContain("min-w-0");
    expect(within(stayGroup).getByLabelText("숙소")).toHaveClass("text-base");
    expect(within(stayGroup).getByLabelText("메모")).toHaveClass("text-base");

    const routeGrid = within(transportGroup)
      .getByLabelText("출발")
      .closest(".grid");
    expect(routeGrid?.className).toContain("grid-cols-1");
    expect(routeGrid?.className).toContain("sm:grid-cols-2");

    const submit = screen.getByRole("button", { name: "변경 저장" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("변경할 일정 내용을 입력해주세요.")).toBeInTheDocument();

    const checkout = within(stayGroup).getByLabelText("체크아웃 날짜");
    fireEvent.change(checkout, { target: { value: "2026-12-10" } });

    expect(checkout).toHaveAttribute("aria-invalid", "true");
    expect(checkout).toHaveAttribute(
      "aria-describedby",
      "itinerary-edit-validation",
    );
    expect(
      screen.getByText("체크아웃 날짜는 체크인 날짜보다 늦어야 합니다."),
    ).toBeInTheDocument();
    expect(submit).toBeDisabled();

    expect(
      container.querySelector('[data-galanda-surface="content"]'),
    ).toHaveClass("max-w-(--content-max-width)");
  });

  it("representative viewport resize와 rerender에서도 긴 local draft와 field identity를 유지한다", () => {
    const view = renderPage();
    const stayGroup = screen.getByRole("group", { name: "숙소 일정 1" });
    const hotelInput = within(stayGroup).getByLabelText("숙소");
    const memoInput = within(stayGroup).getByLabelText("메모");
    const longMemo =
      "320px와 200% 확대에서도 유지되어야 하는 사용자의 긴 숙소 메모입니다. ".repeat(
        4,
      );

    fireEvent.change(hotelInput, { target: { value: LONG_HOTEL_NAME } });
    fireEvent.change(memoInput, { target: { value: longMemo } });

    for (const width of [320, 390, 1440]) {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
      });
      fireEvent(window, new Event("resize"));
      view.rerender(<TestApp />);

      const resizedStayGroup = screen.getByRole("group", {
        name: "숙소 일정 1",
      });
      expect(within(resizedStayGroup).getByLabelText("숙소")).toHaveValue(
        LONG_HOTEL_NAME,
      );
      expect(within(resizedStayGroup).getByLabelText("메모")).toHaveValue(
        longMemo,
      );
      expect(
        document.getElementById("itinerary-edit-form"),
      ).toBeInTheDocument();
    }

    expect(
      screen.getByRole("button", { name: "변경 저장" }),
    ).toBeEnabled();
  });
});

describe("ItineraryEditPage mutation state", () => {
  it("pending 동안 중복 제출을 막고 source identity/revision으로 저장한 뒤에만 이동한다", async () => {
    const request = deferred<ConfirmedItinerary>();
    const mutateAsync = vi.fn(() => request.promise);
    mockUseReviseItineraryMutation.mockReturnValue(
      mutationResult(mutateAsync),
    );

    renderPage();
    const stayGroup = screen.getByRole("group", { name: "숙소 일정 1" });
    fireEvent.change(within(stayGroup).getByLabelText("숙소"), {
      target: { value: LONG_HOTEL_NAME },
    });

    const form = document.getElementById("itinerary-edit-form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      expectedRevision: 4,
      patches: [
        {
          type: "STAY",
          itemId: "stay-tokyo",
          date: "2026-12-10",
          endDate: "2026-12-13",
          hotelName: LONG_HOTEL_NAME,
          memo: "기존 숙소 메모",
        },
      ],
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent(EDIT_PATH);

    const pendingAction = screen.getByRole("button", {
      name: "변경 저장 중...",
    });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute("aria-busy", "true");
    expect(within(stayGroup).getByLabelText("숙소")).toHaveValue(
      LONG_HOTEL_NAME,
    );

    await act(async () => {
      request.resolve({
        ...itinerary,
        currentRevision: RevisionSchema.make(5),
      });
      await request.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${TRIP_ID}/itinerary`,
      ),
    );
  });

  it("일반 저장 실패는 alert로 알리고 draft와 현재 route를 유지한다", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("일정 저장 서버가 응답하지 않았어요."));
    mockUseReviseItineraryMutation.mockReturnValue(
      mutationResult(mutateAsync),
    );

    renderPage();
    const hotelInput = within(
      screen.getByRole("group", { name: "숙소 일정 1" }),
    ).getByLabelText("숙소");
    fireEvent.change(hotelInput, { target: { value: LONG_HOTEL_NAME } });
    fireEvent.submit(
      document.getElementById("itinerary-edit-form") as HTMLFormElement,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "일정 저장 서버가 응답하지 않았어요.",
    );
    expect(hotelInput).toHaveValue(LONG_HOTEL_NAME);
    expect(screen.getByTestId("location-path")).toHaveTextContent(EDIT_PATH);
    expect(
      screen.getByRole("button", { name: "변경 저장" }),
    ).toBeEnabled();
  });

  it("revision conflict에서 latest의 untouched field와 local edit를 rebase하고 새 revision으로 명시적 재시도한다", async () => {
    const latest: ConfirmedItinerary = {
      ...itinerary,
      currentRevision: RevisionSchema.make(5),
      snapshot: {
        ...itinerary.snapshot,
        items: itinerary.snapshot.items.map((item) =>
          item.type === "STAY"
            ? { ...item, memo: "다른 사용자의 최신 메모" }
            : item,
        ),
      },
    };
    const conflict = new ApiClientError({
      status: 409,
      code: "REVISION_CONFLICT",
      message: "다른 사용자가 먼저 수정했습니다.",
      details: { expectedRevision: 4, actualRevision: 5 },
    });
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({
        ...latest,
        currentRevision: RevisionSchema.make(6),
      });
    const refetch = vi.fn().mockResolvedValue({
      isError: false,
      data: confirmedState(latest),
    });
    mockUseItineraryQuery.mockReturnValue(queryResult(itinerary, refetch));
    mockUseReviseItineraryMutation.mockReturnValue(
      mutationResult(mutateAsync),
    );

    renderPage();
    let stayGroup = screen.getByRole("group", { name: "숙소 일정 1" });
    fireEvent.change(within(stayGroup).getByLabelText("숙소"), {
      target: { value: LONG_HOTEL_NAME },
    });
    fireEvent.submit(
      document.getElementById("itinerary-edit-form") as HTMLFormElement,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "내 변경을 최신 일정에 다시 적용했습니다.",
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("수정 기준 v5 · 저장하면 새 revision이 생성됩니다.")).toBeInTheDocument();

    stayGroup = screen.getByRole("group", { name: "숙소 일정 1" });
    expect(within(stayGroup).getByLabelText("숙소")).toHaveValue(
      LONG_HOTEL_NAME,
    );
    expect(within(stayGroup).getByLabelText("메모")).toHaveValue(
      "다른 사용자의 최신 메모",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "내 변경 다시 저장" }),
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenLastCalledWith({
      tripId: TRIP_ID,
      expectedRevision: 5,
      patches: [
        {
          type: "STAY",
          itemId: "stay-tokyo",
          date: "2026-12-10",
          endDate: "2026-12-13",
          hotelName: LONG_HOTEL_NAME,
          memo: "다른 사용자의 최신 메모",
        },
      ],
    });
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${TRIP_ID}/itinerary`,
      ),
    );
  });
});
