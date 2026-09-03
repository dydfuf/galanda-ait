// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FirstPlanWizard } from "./FirstPlanWizard.tsx";
import type { FirstPlanWizardCursor } from "../first-plan-wizard-flow.ts";
import type { PlanEditorFormData } from "../hooks/usePlanEditorState.ts";
import type { BookingStatus } from "../../../core/domain/room.ts";

const mockFormData: PlanEditorFormData = {
  title: "제주 힐링 여행",
  proposalReason: "여유로운 자연 힐링 코스",
  baseHeadcount: 2,
  routes: [
    { city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "제주",
      period: "2026-10-01 ~ 2026-10-04",
      nights: 3,
      hotelName: "신라호텔",
      isSearching: false,
      bookingStatus: "AVAILABLE",
    },
  ],
  transports: [
    {
      id: "tr-1",
      fromCity: "김포",
      toCity: "제주",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 10분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-2",
      fromCity: "제주",
      toCity: "김포",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 10분",
      bookingStatus: "AVAILABLE",
    },
  ],
};

interface RenderWizardOptions {
  readonly cursor: FirstPlanWizardCursor;
  readonly formData?: Partial<PlanEditorFormData>;
  readonly draftSaveStatus?: "IDLE" | "SAVING" | "SAVED" | "ERROR";
  readonly onTitleChange?: (val: string) => void;
  readonly onProposalReasonChange?: (val: string) => void;
  readonly onHeadcountChange?: (val: number) => void;
  readonly onCityChange?: (index: number, val: string) => void;
  readonly onArrivalDateChange?: (index: number, val: string) => void;
  readonly onDepartureDateChange?: (index: number, val: string) => void;
  readonly onAddCity?: (city?: string) => void;
  readonly onAccommodationStatusChange?: (index: number, isSearching: boolean) => void;
  readonly onHotelNameChange?: (index: number, val: string) => void;
  readonly onTransportEndpointsChange?: (index: number, fromCity: string, toCity: string) => void;
  readonly onTransportStatusChange?: (index: number, bookingStatus: BookingStatus) => void;
  readonly onTransportModeChange?: (index: number, val: string) => void;
  readonly onTransportDurationChange?: (index: number, val: string) => void;
  readonly onNext?: () => void;
  readonly onPrevious?: () => void;
  readonly onSkip?: () => void;
}

const renderWizard = ({
  cursor,
  formData = {},
  draftSaveStatus = "SAVED",
  onTitleChange = vi.fn(),
  onProposalReasonChange = vi.fn(),
  onHeadcountChange = vi.fn(),
  onCityChange = vi.fn(),
  onArrivalDateChange = vi.fn(),
  onDepartureDateChange = vi.fn(),
  onAddCity = vi.fn(),
  onAccommodationStatusChange = vi.fn(),
  onHotelNameChange = vi.fn(),
  onTransportEndpointsChange = vi.fn(),
  onTransportStatusChange = vi.fn(),
  onTransportModeChange = vi.fn(),
  onTransportDurationChange = vi.fn(),
  onNext = vi.fn(),
  onPrevious = vi.fn(),
  onSkip = vi.fn(),
}: RenderWizardOptions) => {
  const currentFormData: PlanEditorFormData = {
    ...mockFormData,
    ...formData,
  };

  const utils = render(
    <FirstPlanWizard
      cursor={cursor}
      formData={currentFormData}
      draftSaveStatus={draftSaveStatus}
      onTitleChange={onTitleChange}
      onProposalReasonChange={onProposalReasonChange}
      onHeadcountChange={onHeadcountChange}
      onCityChange={onCityChange}
      onArrivalDateChange={onArrivalDateChange}
      onDepartureDateChange={onDepartureDateChange}
      onAddCity={onAddCity}
      onAccommodationStatusChange={onAccommodationStatusChange}
      onHotelNameChange={onHotelNameChange}
      onTransportEndpointsChange={onTransportEndpointsChange}
      onTransportStatusChange={onTransportStatusChange}
      onTransportModeChange={onTransportModeChange}
      onTransportDurationChange={onTransportDurationChange}
      onNext={onNext}
      onPrevious={onPrevious}
      onSkip={onSkip}
    />,
  );

  return {
    ...utils,
    onTitleChange,
    onProposalReasonChange,
    onHeadcountChange,
    onCityChange,
    onArrivalDateChange,
    onDepartureDateChange,
    onAddCity,
    onAccommodationStatusChange,
    onHotelNameChange,
    onTransportEndpointsChange,
    onTransportStatusChange,
    onTransportModeChange,
    onTransportDurationChange,
    onNext,
    onPrevious,
    onSkip,
  };
};

describe("FirstPlanWizard - Basic Info Questions", () => {
  describe("Question Isolation", () => {
    it("renders only title input when cursor is basic/title", () => {
      renderWizard({
        cursor: { section: "basic", question: "title" },
      });

      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
      expect(
        screen.queryByLabelText(/제안 이유|한 줄 요약/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: /비용 기준 인원/ }),
      ).not.toBeInTheDocument();
    });

    it("renders only proposal reason input when cursor is basic/proposal-reason", () => {
      renderWizard({
        cursor: { section: "basic", question: "proposal-reason" },
      });

      expect(
        screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("여행안 제목 *")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: /비용 기준 인원/ }),
      ).not.toBeInTheDocument();
    });

    it("renders only headcount stepper when cursor is basic/headcount", () => {
      renderWizard({
        cursor: { section: "basic", question: "headcount" },
      });

      expect(
        screen.getByRole("group", { name: /비용 기준 인원/ }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("여행안 제목 *")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/제안 이유|한 줄 요약/),
      ).not.toBeInTheDocument();
    });
  });

  describe("Autofocus Behavior", () => {
    it("autofocuses title input upon mount when cursor is basic/title", () => {
      renderWizard({
        cursor: { section: "basic", question: "title" },
      });

      expect(screen.getByLabelText("여행안 제목 *")).toHaveFocus();
    });
  });

  describe("Keyboard Enter Navigation & Korean IME Composition Guard", () => {
    it("advances to next question on Enter key when not composing", () => {
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "basic", question: "title" },
        formData: { title: "도쿄 온천 여행" },
        onNext,
      });

      const input = screen.getByLabelText("여행안 제목 *");
      fireEvent.keyDown(input, { key: "Enter", isComposing: false });

      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("does NOT advance to next question when Enter is pressed during Korean IME composition", () => {
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "basic", question: "title" },
        formData: { title: "제주도" },
        onNext,
      });

      const input = screen.getByLabelText("여행안 제목 *");
      fireEvent.keyDown(input, {
        key: "Enter",
        isComposing: true,
        keyCode: 229,
      });

      expect(onNext).not.toHaveBeenCalled();
    });
  });
});

describe("FirstPlanWizard - Route Questions", () => {
  describe("City Question (`route/city`)", () => {
    it("renders single city input and character counter", () => {
      renderWizard({
        cursor: { section: "route", question: "city", index: 0 },
        formData: { routes: [{ city: "제주", arrivalDate: "", departureDate: "" }] },
      });

      expect(screen.getByLabelText("방문 도시 *")).toBeInTheDocument();
      expect(screen.getByLabelText("방문 도시 *")).toHaveValue("제주");
      expect(screen.getByText("2/30")).toBeInTheDocument();
    });

    it("disables Next button when city input is empty", () => {
      renderWizard({
        cursor: { section: "route", question: "city", index: 0 },
        formData: { routes: [{ city: "", arrivalDate: "", departureDate: "" }] },
      });

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeDisabled();
    });

    it("calls onCityChange when user types", () => {
      const onCityChange = vi.fn();
      renderWizard({
        cursor: { section: "route", question: "city", index: 0 },
        formData: { routes: [{ city: "", arrivalDate: "", departureDate: "" }] },
        onCityChange,
      });

      const input = screen.getByLabelText("방문 도시 *");
      fireEvent.change(input, { target: { value: "파리" } });
      expect(onCityChange).toHaveBeenCalledWith(0, "파리");
    });

    it("supports repeated city visits without error", () => {
      renderWizard({
        cursor: { section: "route", question: "city", index: 1 },
        formData: {
          routes: [
            { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
            { city: "도쿄", arrivalDate: "2026-10-05", departureDate: "2026-10-07" },
          ],
        },
      });

      expect(screen.getByLabelText("방문 도시 *")).toHaveValue("도쿄");
      expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
    });
  });

  describe("Arrival Date Question (`route/arrival-date`)", () => {
    it("renders arrival date input", () => {
      renderWizard({
        cursor: { section: "route", question: "arrival-date", index: 0 },
        formData: { routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "" }] },
      });

      expect(screen.getByLabelText("도착일 *")).toBeInTheDocument();
      expect(screen.getByLabelText("도착일 *")).toHaveValue("2026-10-01");
    });

    it("validates overlapping dates with previous stop departure", () => {
      renderWizard({
        cursor: { section: "route", question: "arrival-date", index: 1 },
        formData: {
          routes: [
            { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
            { city: "하코네", arrivalDate: "2026-10-03", departureDate: "2026-10-06" }, // overlaps with 10-04
          ],
        },
      });

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeDisabled();

      // Trigger touch
      const input = screen.getByLabelText("도착일 *");
      fireEvent.blur(input);
      expect(screen.getByText("도시 체류 일정은 서로 겹칠 수 없습니다.")).toBeInTheDocument();
    });

    it("permits date gaps between consecutive stops", () => {
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "route", question: "arrival-date", index: 1 },
        formData: {
          routes: [
            { city: "파리", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
            { city: "로마", arrivalDate: "2026-10-07", departureDate: "2026-10-10" }, // 3-day gap
          ],
        },
        onNext,
      });

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeEnabled();
      fireEvent.click(nextButton);
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("Departure Date Question (`route/departure-date`)", () => {
    it("renders departure date and displays calculated stay duration", () => {
      renderWizard({
        cursor: { section: "route", question: "departure-date", index: 0 },
        formData: { routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }] },
      });

      expect(screen.getByLabelText("출발일 *")).toBeInTheDocument();
      expect(screen.getByText(/3박 4일 일정/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
    });

    it("rejects departure date on or before arrival date", () => {
      renderWizard({
        cursor: { section: "route", question: "departure-date", index: 0 },
        formData: { routes: [{ city: "제주", arrivalDate: "2026-10-04", departureDate: "2026-10-04" }] }, // same day
      });

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeDisabled();

      const input = screen.getByLabelText("출발일 *");
      fireEvent.blur(input);
      expect(screen.getByText("출발일은 도착일 이후여야 합니다.")).toBeInTheDocument();
    });
  });

  describe("Add City Question (`route/add-city`)", () => {
    it("renders current route summary and action button to add next city", () => {
      const onAddCity = vi.fn();
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "route", question: "add-city", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
        },
        onAddCity,
        onNext,
      });

      expect(screen.getByText("현재 여행 경로")).toBeInTheDocument();
      expect(screen.getByText(/도시 1 · 제주/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ 도시 추가하기" })).toBeInTheDocument();

      const addCityBtn = screen.getByRole("button", { name: "+ 도시 추가하기" });
      fireEvent.click(addCityBtn);
      expect(onAddCity).toHaveBeenCalled();
      expect(onNext).not.toHaveBeenCalled();
    });

    it("renders next button labeled '다음: 숙소' to advance to accommodation stage", () => {
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "route", question: "add-city", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
        },
        onNext,
      });

      const nextBtn = screen.getByRole("button", { name: "다음: 숙소" });
      expect(nextBtn).toBeEnabled();
      fireEvent.click(nextBtn);
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });
});

describe("FirstPlanWizard - Accommodation Questions", () => {
  describe("Status Question (`accommodation/status`)", () => {
    it("renders choice cards for '정했어요' vs '알아보는 중'", () => {
      renderWizard({
        cursor: { section: "accommodation", question: "status", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [
            { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" },
          ],
        },
      });

      expect(screen.getByRole("radio", { name: /정했어요/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /알아보는 중/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /알아보는 중/ })).toHaveAttribute("aria-checked", "true");
    });

    it("updates status to decided when '정했어요' is chosen", () => {
      const onAccommodationStatusChange = vi.fn();
      renderWizard({
        cursor: { section: "accommodation", question: "status", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [
            { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" },
          ],
        },
        onAccommodationStatusChange,
      });

      const decidedBtn = screen.getByRole("radio", { name: /정했어요/ });
      fireEvent.click(decidedBtn);
      expect(onAccommodationStatusChange).toHaveBeenCalledWith(0, false);
    });

    it("renders next button label '다음: 교통' when last stay is searching", () => {
      renderWizard({
        cursor: { section: "accommodation", question: "status", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [
            { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" },
          ],
        },
      });

      expect(screen.getByRole("button", { name: "다음: 교통" })).toBeInTheDocument();
    });
    it("commits default searching status when clicking next without manually selecting a card", () => {
      const onAccommodationStatusChange = vi.fn();
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "accommodation", question: "status", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [],
        },
        onAccommodationStatusChange,
        onNext,
      });

      const nextBtn = screen.getByRole("button", { name: "다음: 교통" });
      fireEvent.click(nextBtn);

      expect(onAccommodationStatusChange).toHaveBeenCalledWith(0, true);
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("Hotel Name Question (`accommodation/hotel-name`)", () => {
    it("renders hotel name input when accommodation is decided", () => {
      renderWizard({
        cursor: { section: "accommodation", question: "hotel-name", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [
            { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "신라호텔", isSearching: false, bookingStatus: "AVAILABLE" },
          ],
        },
      });

      expect(screen.getByLabelText("숙소명 / 호텔명 *")).toBeInTheDocument();
      expect(screen.getByLabelText("숙소명 / 호텔명 *")).toHaveValue("신라호텔");
      expect(screen.getByRole("button", { name: "다음: 교통" })).toBeEnabled();
    });

    it("disables next button when decided hotel name is empty", () => {
      renderWizard({
        cursor: { section: "accommodation", question: "hotel-name", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [
            { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "", isSearching: false, bookingStatus: "AVAILABLE" },
          ],
        },
      });

      expect(screen.getByRole("button", { name: "다음: 교통" })).toBeDisabled();
    });

    it("disables next button when hotel name is empty even if accommodations is unpopulated", () => {
      renderWizard({
        cursor: { section: "accommodation", question: "hotel-name", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [],
        },
      });

      expect(screen.getByRole("button", { name: "다음: 교통" })).toBeDisabled();
    });

    it("advances on Enter when hotel name is valid", () => {
      const onNext = vi.fn();
      renderWizard({
        cursor: { section: "accommodation", question: "hotel-name", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [
            { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "그랜드 조선 호텔", isSearching: false, bookingStatus: "AVAILABLE" },
          ],
        },
        onNext,
      });

      const input = screen.getByLabelText("숙소명 / 호텔명 *");
      fireEvent.keyDown(input, { key: "Enter", isComposing: false });
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });
});

describe("FirstPlanWizard - Transport Questions", () => {
  describe("Endpoints Question (`transport/endpoints`)", () => {
    it("renders departure and arrival inputs with suggested values", () => {
      renderWizard({
        cursor: { section: "transport", question: "endpoints", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          transports: [
            { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
          ],
        },
      });

      expect(screen.getByLabelText("출발지 *")).toHaveValue("김포");
      expect(screen.getByLabelText("도착지 *")).toHaveValue("제주");
      expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
    });

    it("calls onTransportEndpointsChange when user customizes departure or arrival", () => {
      const onTransportEndpointsChange = vi.fn();
      renderWizard({
        cursor: { section: "transport", question: "endpoints", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          transports: [
            { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
          ],
        },
        onTransportEndpointsChange,
      });

      const fromInput = screen.getByLabelText("출발지 *");
      fireEvent.change(fromInput, { target: { value: "인천" } });
      expect(onTransportEndpointsChange).toHaveBeenCalledWith(0, "인천", "제주");
    });
  });

  describe("Status Question (`transport/status`)", () => {
    it("renders choice cards for '정했어요' vs '아직 안 정함'", () => {
      renderWizard({
        cursor: { section: "transport", question: "status", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          transports: [
            { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
            { id: "tr-2", fromCity: "제주", toCity: "김포", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
          ],
        },
      });

      expect(screen.getByRole("radio", { name: /정했어요/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /아직 안 정함/ })).toBeInTheDocument();
    });

    it("displays '입력 내용 검토하기' button label on last leg when NOT_CHECKED", () => {
      renderWizard({
        cursor: { section: "transport", question: "status", index: 1 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          transports: [
            { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
            { id: "tr-2", fromCity: "제주", toCity: "김포", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
          ],
        },
      });

      expect(screen.getByRole("button", { name: "입력 내용 검토하기" })).toBeInTheDocument();
    });
  });

  describe("Mode Question (`transport/mode`)", () => {
    it("renders preset mode chips and updates value on click", () => {
      const onTransportModeChange = vi.fn();
      renderWizard({
        cursor: { section: "transport", question: "mode", index: 0 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          transports: [
            { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" },
          ],
        },
        onTransportModeChange,
      });

      expect(screen.getByRole("button", { name: "항공" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "기차/KTX" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "항공" }));
      expect(onTransportModeChange).toHaveBeenCalledWith(0, "항공");
    });
  });

  describe("Duration Question (`transport/duration`)", () => {
    it("renders preset duration chips and displays '입력 내용 검토하기' on last leg", () => {
      const onTransportDurationChange = vi.fn();
      renderWizard({
        cursor: { section: "transport", question: "duration", index: 1 },
        formData: {
          routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          transports: [
            { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: "1시간 10분", bookingStatus: "AVAILABLE" },
            { id: "tr-2", fromCity: "제주", toCity: "김포", mode: "항공", hasTransfer: false, durationText: "1시간 10분", bookingStatus: "AVAILABLE" },
          ],
        },
        onTransportDurationChange,
      });

      expect(screen.getByRole("button", { name: "약 1시간" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "입력 내용 검토하기" })).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: "약 1시간" }));
      expect(onTransportDurationChange).toHaveBeenCalledWith(1, "약 1시간");
    });
  });
});

describe("FirstPlanWizard - Review Mode and Return Navigation", () => {
  it("renders '검토로 돌아가기' button when cursor has returnToReview: true", () => {
    const onPrevious = vi.fn();
    renderWizard({
      cursor: { section: "route", question: "city", index: 0, returnToReview: true },
      formData: {
        routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
      },
      onPrevious,
    });

    const backBtn = screen.getByRole("button", { name: "검토로 돌아가기" });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});

describe("FirstPlanWizard - 30-character Validation", () => {
  it("30자 초과 여행안 제목 입력 시 인라인 에러를 노출하고 다음 버튼을 비활성화한다", () => {
    renderWizard({
      cursor: { section: "basic", question: "title" },
      formData: {
        title: "가".repeat(31),
      },
    });

    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    expect(screen.getByText("여행안 제목은 최대 30자까지 입력할 수 있어요.")).toBeInTheDocument();
    expect(screen.getByText("31/30")).toBeInTheDocument();
  });

  it("30자 초과 도시 이름 입력 시 인라인 에러를 노출하고 다음 버튼을 비활성화한다", () => {
    renderWizard({
      cursor: { section: "route", question: "city", index: 0 },
      formData: {
        routes: [{ city: "나".repeat(31), arrivalDate: "", departureDate: "" }],
      },
    });

    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    expect(screen.getByText("도시 이름은 최대 30자까지 입력할 수 있어요.")).toBeInTheDocument();
    expect(screen.getByText("31/30")).toBeInTheDocument();
  });
});

