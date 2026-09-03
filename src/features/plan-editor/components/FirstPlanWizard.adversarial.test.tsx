// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { FirstPlanWizard } from "./FirstPlanWizard.tsx";
import type { FirstPlanWizardCursor } from "../first-plan-wizard-flow.ts";
import {
  usePlanEditorState,
  type PlanEditorFormData,
} from "../hooks/usePlanEditorState.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { OFFLINE_MUTATION_MESSAGE } from "@/app/offline-mutation.ts";

import { TripIdSchema, ParticipantIdSchema, RevisionSchema } from "../../../core/domain/ids.ts";

const mockTripRoom: TripRoom = {
  id: TripIdSchema.make("room-adv-1"),
  title: "테스트 여행방",
  destination: "제주",
  revision: RevisionSchema.make(1),
  members: [
    { id: ParticipantIdSchema.make("member-1"), name: "방장", role: "HOST" },
    { id: ParticipantIdSchema.make("member-2"), name: "게스트", role: "MEMBER" },
  ],
  plans: [],
};

describe("Adversarial Test Suite — FirstPlanWizard", () => {
  // =========================================================================
  // 1. Route Date Boundaries & Complex Routing
  // =========================================================================
  describe("1. Route Date Boundaries & Complex Routing", () => {
    it("rejects departure date strictly equal to arrival date (0-night stay)", () => {
      const onNext = vi.fn<() => void>();
      render(
        <FirstPlanWizard cursor={{ section: "route", question: "departure-date", index: 0 }}
          formData={{
            title: "당일치기 불가 검증",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "제주", arrivalDate: "2026-10-10", departureDate: "2026-10-10" }],
            accommodations: [],
            transports: [],
          }}
          onNext={onNext}
         onPrevious={vi.fn()} />
      );

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeDisabled();

      const input = screen.getByLabelText("출발일 *");
      fireEvent.blur(input);
      expect(screen.getByText("출발일은 도착일 이후여야 합니다.")).toBeInTheDocument();

      // Enter key press should not advance
      fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });
      expect(onNext).not.toHaveBeenCalled();
    });

    it("rejects departure date before arrival date", () => {
      const onNext = vi.fn<() => void>();
      render(
        <FirstPlanWizard cursor={{ section: "route", question: "departure-date", index: 0 }}
          formData={{
            title: "역전된 날짜 검증",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "부산", arrivalDate: "2026-10-15", departureDate: "2026-10-14" }],
            accommodations: [],
            transports: [],
          }}
          onNext={onNext}
         onPrevious={vi.fn()} />
      );

      expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
      const input = screen.getByLabelText("출발일 *");
      fireEvent.blur(input);
      expect(screen.getByText("출발일은 도착일 이후여야 합니다.")).toBeInTheDocument();

      fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });
      expect(onNext).not.toHaveBeenCalled();
    });

    it("permits arrival date on same day as previous stop departure (consecutive stop transition)", () => {
      const onNext = vi.fn<() => void>();
      render(
        <FirstPlanWizard cursor={{ section: "route", question: "arrival-date", index: 1 }}
          formData={{
            title: "연속 이동 일정",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [
              { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
              { city: "오사카", arrivalDate: "2026-10-04", departureDate: "2026-10-07" },
            ],
            accommodations: [],
            transports: [],
          }}
          onNext={onNext}
         onPrevious={vi.fn()} />
      );

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeEnabled();
      fireEvent.click(nextButton);
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("permits non-overlapping date gaps (e.g. overnight travel or 5-day pause between stops)", () => {
      const onNext = vi.fn<() => void>();
      render(
        <FirstPlanWizard cursor={{ section: "route", question: "arrival-date", index: 1 }}
          formData={{
            title: "유럽 장거리 이동 갭",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [
              { city: "런던", arrivalDate: "2026-10-01", departureDate: "2026-10-05" },
              { city: "파리", arrivalDate: "2026-10-10", departureDate: "2026-10-15" },
            ],
            accommodations: [],
            transports: [],
          }}
          onNext={onNext}
         onPrevious={vi.fn()} />
      );

      expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
      expect(screen.queryByText("도시 체류 일정은 서로 겹칠 수 없습니다.")).not.toBeInTheDocument();
    });

    it("rejects arrival date that overlaps with previous stop departure date", () => {
      const onNext = vi.fn<() => void>();
      render(
        <FirstPlanWizard cursor={{ section: "route", question: "arrival-date", index: 1 }}
          formData={{
            title: "중복 일정",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [
              { city: "런던", arrivalDate: "2026-10-01", departureDate: "2026-10-06" },
              { city: "파리", arrivalDate: "2026-10-05", departureDate: "2026-10-10" },
            ],
            accommodations: [],
            transports: [],
          }}
          onNext={onNext}
         onPrevious={vi.fn()} />
      );

      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeDisabled();

      const input = screen.getByLabelText("도착일 *");
      fireEvent.blur(input);
      expect(screen.getByText("도시 체류 일정은 서로 겹칠 수 없습니다.")).toBeInTheDocument();

      fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });
      expect(onNext).not.toHaveBeenCalled();
    });

    it("supports same-city repeated visits (e.g., A -> B -> A) without false duplicate city errors", () => {
      const onCityChange = vi.fn<(index: number, val: string) => void>();
      render(
        <FirstPlanWizard cursor={{ section: "route", question: "city", index: 2 }}
          formData={{
            title: "왕복 및 재방문 코스",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [
              { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
              { city: "하코네", arrivalDate: "2026-10-03", departureDate: "2026-10-05" },
              { city: "도쿄", arrivalDate: "2026-10-05", departureDate: "2026-10-07" },
            ],
            accommodations: [],
            transports: [],
          }}
          onCityChange={onCityChange}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      const cityInput = screen.getByLabelText("방문 도시 *");
      expect(cityInput).toHaveValue("도쿄");
      expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
      expect(screen.queryByText(/이미 추가된 도시/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Accommodation Status Toggle & State Synchronization
  // =========================================================================
  describe("2. Accommodation Status Toggle & State Synchronization", () => {
    it("clears hotelName and sets bookingStatus to NOT_CHECKED when switching Decided -> Searching via editor hook", () => {
      const { result } = renderHook(() => usePlanEditorState(mockTripRoom, undefined, undefined, "user-host"));

      // Setup initial route and accommodation
      act(() => {
        result.current.handleAddCity("제주");
        result.current.handleUpdateCity(0, {
          city: "제주",
          arrivalDate: "2026-10-01",
          departureDate: "2026-10-04",
        });
        result.current.handleAddAccommodation({
          id: "acc-1",
          city: "제주",
          period: "2026-10-01 ~ 2026-10-04",
          nights: 3,
          hotelName: "신라호텔 제주",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        });
      });

      expect(result.current.accommodations[0]?.isSearching).toBe(false);
      expect(result.current.accommodations[0]?.hotelName).toBe("신라호텔 제주");
      expect(result.current.accommodations[0]?.bookingStatus).toBe("AVAILABLE");

      // Mount FirstPlanWizard with the editor hook
      render(
        <FirstPlanWizard cursor={{ section: "accommodation", question: "status", index: 0 }}
          editor={result.current}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      // Click "알아보는 중" (Searching)
      const searchingButton = screen.getByRole("radio", { name: /알아보는 중/ });
      act(() => {
        fireEvent.click(searchingButton);
      });

      // Verify state in editor hook
      expect(result.current.accommodations[0]?.isSearching).toBe(true);
      expect(result.current.accommodations[0]?.hotelName).toBe("");
      expect(result.current.accommodations[0]?.bookingStatus).toBe("NOT_CHECKED");
    });

    it("triggers onAccommodationStatusChange callback with isSearching flag when standalone", () => {
      const onAccommodationStatusChange = vi.fn<(index: number, isSearching: boolean) => void>();
      render(
        <FirstPlanWizard cursor={{ section: "accommodation", question: "status", index: 0 }}
          formData={{
            title: "숙소 토글 검증",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
            accommodations: [
              {
                id: "acc-1",
                city: "부산",
                period: "2026-10-01 ~ 2026-10-03",
                nights: 2,
                hotelName: "파라다이스 호텔",
                isSearching: false,
                bookingStatus: "AVAILABLE",
              },
            ],
            transports: [],
          }}
          onAccommodationStatusChange={onAccommodationStatusChange}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      const searchingRadio = screen.getByRole("radio", { name: /알아보는 중/ });
      fireEvent.click(searchingRadio);
      expect(onAccommodationStatusChange).toHaveBeenCalledWith(0, true);

      const decidedRadio = screen.getByRole("radio", { name: /정했어요/ });
      fireEvent.click(decidedRadio);
      expect(onAccommodationStatusChange).toHaveBeenCalledWith(0, false);
    });

    it("disables next button on hotel-name question when decided hotel name is whitespace only", () => {
      render(
        <FirstPlanWizard cursor={{ section: "accommodation", question: "hotel-name", index: 0 }}
          formData={{
            title: "공백 호텔명 검증",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "강릉", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
            accommodations: [
              {
                id: "acc-1",
                city: "강릉",
                period: "2026-10-01 ~ 2026-10-03",
                nights: 2,
                hotelName: "   ",
                isSearching: false,
                bookingStatus: "AVAILABLE",
              },
            ],
            transports: [],
          }}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      expect(screen.getByRole("button", { name: "다음: 교통" })).toBeDisabled();
    });
  });

  // =========================================================================
  // 3. Transport N+1 Legs & Custom Endpoints Preservation
  // =========================================================================
  describe("3. Transport N+1 Legs & Endpoints Suggestion / Customization", () => {
    it("proposes correct endpoints for N+1 legs with 2 routes (3 transport legs)", () => {
      const routes = [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
        { city: "오사카", arrivalDate: "2026-10-03", departureDate: "2026-10-06" },
      ];

      // Leg 0: [출발지] -> 도쿄
      const { unmount: unmount0 } = render(
        <FirstPlanWizard cursor={{ section: "transport", question: "endpoints", index: 0 }}
          formData={{ title: "3구간 교통", proposalReason: "", baseHeadcount: 2, routes, accommodations: [], transports: [] }}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );
      expect(screen.getByText("출발지와 첫 방문지를 확인해주세요")).toBeInTheDocument();
      expect(screen.getByLabelText("도착지 *")).toHaveValue("도쿄");
      unmount0();

      // Leg 1: 도쿄 -> 오사카
      const { unmount: unmount1 } = render(
        <FirstPlanWizard cursor={{ section: "transport", question: "endpoints", index: 1 }}
          formData={{ title: "3구간 교통", proposalReason: "", baseHeadcount: 2, routes, accommodations: [], transports: [] }}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );
      expect(screen.getByText("도시 간 이동 구간을 확인해주세요")).toBeInTheDocument();
      expect(screen.getByLabelText("출발지 *")).toHaveValue("도쿄");
      expect(screen.getByLabelText("도착지 *")).toHaveValue("오사카");
      unmount1();

      // Leg 2 (Last leg): 오사카 -> [도착지]
      render(
        <FirstPlanWizard cursor={{ section: "transport", question: "endpoints", index: 2 }}
          formData={{ title: "3구간 교통", proposalReason: "", baseHeadcount: 2, routes, accommodations: [], transports: [] }}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );
      expect(screen.getByText("마지막 방문지와 도착지를 확인해주세요")).toBeInTheDocument();
      expect(screen.getByLabelText("출발지 *")).toHaveValue("오사카");
    });

    it("preserves user-customized endpoints without being overwritten by defaults", () => {
      const onTransportEndpointsChange = vi.fn<(index: number, fromCity: string, toCity: string) => void>();
      render(
        <FirstPlanWizard cursor={{ section: "transport", question: "endpoints", index: 0 }}
          formData={{
            title: "커스텀 출발지",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
            transports: [
              {
                id: "tr-1",
                fromCity: "청주국제공항",
                toCity: "제주국제공항",
                mode: "항공",
                hasTransfer: false,
                durationText: "1시간",
                bookingStatus: "AVAILABLE",
              },
            ],
            accommodations: [],
          }}
          onTransportEndpointsChange={onTransportEndpointsChange}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      const fromInput = screen.getByLabelText("출발지 *");
      const toInput = screen.getByLabelText("도착지 *");
      expect(fromInput).toHaveValue("청주국제공항");
      expect(toInput).toHaveValue("제주국제공항");

      fireEvent.change(fromInput, { target: { value: "대구공항" } });
      expect(onTransportEndpointsChange).toHaveBeenCalledWith(0, "대구공항", "제주국제공항");
    });

    it("clears transport mode and duration when switching from Decided to NOT_CHECKED via editor hook", () => {
      const { result } = renderHook(() => usePlanEditorState(mockTripRoom, undefined, undefined, "user-host"));

      act(() => {
        result.current.handleAddCity("제주");
        result.current.handleAddTransport({
          id: "tr-1",
          fromCity: "김포",
          toCity: "제주",
          mode: "항공",
          hasTransfer: false,
          durationText: "1시간 10분",
          bookingStatus: "AVAILABLE",
        });
      });

      expect(result.current.transports[0]?.bookingStatus).toBe("AVAILABLE");
      expect(result.current.transports[0]?.mode).toBe("항공");
      expect(result.current.transports[0]?.durationText).toBe("1시간 10분");

      render(
        <FirstPlanWizard cursor={{ section: "transport", question: "status", index: 0 }}
          editor={result.current}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      const notCheckedRadio = screen.getByRole("radio", { name: /아직 안 정함/ });
      act(() => {
        fireEvent.click(notCheckedRadio);
      });

      expect(result.current.transports[0]?.bookingStatus).toBe("NOT_CHECKED");
      expect(result.current.transports[0]?.mode).toBe("");
      expect(result.current.transports[0]?.durationText).toBe("");
    });

    it("allows preset chip selection AND custom text input for mode & duration", () => {
      const onTransportModeChange = vi.fn<(index: number, val: string) => void>();
      const onTransportDurationChange = vi.fn<(index: number, val: string) => void>();

      const { unmount } = render(
        <FirstPlanWizard cursor={{ section: "transport", question: "mode", index: 0 }}
          formData={{
            title: "교통수단 입력",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
            transports: [{ id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" }],
            accommodations: [],
          }}
          onTransportModeChange={onTransportModeChange}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      // Click preset chip "기차/KTX"
      fireEvent.click(screen.getByRole("button", { name: "기차/KTX" }));
      expect(onTransportModeChange).toHaveBeenCalledWith(0, "기차/KTX");

      // Custom input typing
      const modeInput = screen.getByLabelText("교통수단 *");
      fireEvent.change(modeInput, { target: { value: "유람선" } });
      expect(onTransportModeChange).toHaveBeenCalledWith(0, "유람선");
      unmount();

      // Duration screen
      render(
        <FirstPlanWizard cursor={{ section: "transport", question: "duration", index: 0 }}
          formData={{
            title: "소요시간 입력",
            proposalReason: "",
            baseHeadcount: 2,
            routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
            transports: [{ id: "tr-1", fromCity: "김포", toCity: "제주", mode: "유람선", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" }],
            accommodations: [],
          }}
          onTransportDurationChange={onTransportDurationChange}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      // Click preset chip "약 2시간"
      fireEvent.click(screen.getByRole("button", { name: "약 2시간" }));
      expect(onTransportDurationChange).toHaveBeenCalledWith(0, "약 2시간");

      // Custom input typing
      const durationInput = screen.getByLabelText("예상 소요시간 *");
      fireEvent.change(durationInput, { target: { value: "1시간 45분" } });
      expect(onTransportDurationChange).toHaveBeenCalledWith(0, "1시간 45분");
    });
  });

  // =========================================================================
  // 4. Korean IME Composition Guard on All Form Inputs
  // =========================================================================
  describe("4. Korean IME Composition Guard on Enter Key across All Question Screens", () => {
    const questionsWithInput: Array<{
      cursor: FirstPlanWizardCursor;
      label: string;
      formData: Partial<PlanEditorFormData>;
    }> = [
      {
        cursor: { section: "basic", question: "title" },
        label: "여행안 제목 *",
        formData: { title: "서울 힐링" },
      },
      {
        cursor: { section: "basic", question: "proposal-reason" },
        label: "제안 이유 / 한 줄 요약 (선택)",
        formData: { proposalReason: "휴식" },
      },
      {
        cursor: { section: "route", question: "city", index: 0 },
        label: "방문 도시 *",
        formData: { routes: [{ city: "부산", arrivalDate: "", departureDate: "" }] },
      },
      {
        cursor: { section: "route", question: "arrival-date", index: 0 },
        label: "도착일 *",
        formData: { routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "" }] },
      },
      {
        cursor: { section: "route", question: "departure-date", index: 0 },
        label: "출발일 *",
        formData: { routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }] },
      },
      {
        cursor: { section: "accommodation", question: "hotel-name", index: 0 },
        label: "숙소명 / 호텔명 *",
        formData: {
          routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
          accommodations: [{ id: "acc-1", city: "부산", period: "2026-10-01 ~ 2026-10-03", nights: 2, hotelName: "웨스틴 조선", isSearching: false, bookingStatus: "AVAILABLE" }],
        },
      },
      {
        cursor: { section: "transport", question: "endpoints", index: 0 },
        label: "출발지 *",
        formData: {
          routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
          transports: [{ id: "tr-1", fromCity: "서울", toCity: "부산", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" }],
        },
      },
      {
        cursor: { section: "transport", question: "mode", index: 0 },
        label: "교통수단 *",
        formData: {
          routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
          transports: [{ id: "tr-1", fromCity: "서울", toCity: "부산", mode: "KTX", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" }],
        },
      },
      {
        cursor: { section: "transport", question: "duration", index: 0 },
        label: "예상 소요시간 *",
        formData: {
          routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
          transports: [{ id: "tr-1", fromCity: "서울", toCity: "부산", mode: "KTX", hasTransfer: false, durationText: "2시간 30분", bookingStatus: "AVAILABLE" }],
        },
      },
    ];

    questionsWithInput.forEach(({ cursor, label, formData }) => {
      it(`guards against IME composition on Enter for ${cursor.section}/${cursor.question}`, () => {
        const onNext = vi.fn<() => void>();
        const { unmount } = render(
          <FirstPlanWizard cursor={cursor}
            formData={{
              title: "IME 테스트",
              proposalReason: "",
              baseHeadcount: 2,
              routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
              accommodations: [],
              transports: [],
              ...formData,
            }}
            onNext={onNext}
           onPrevious={vi.fn()} />
        );

        const input = screen.getByLabelText(label);

        // 1. During composition: should NOT trigger onNext
        fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
        expect(onNext).not.toHaveBeenCalled();

        // 2. After composition finished: should trigger onNext
        fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });
        expect(onNext).toHaveBeenCalledTimes(1);

        unmount();
      });
    });
  });

  // =========================================================================
  // 5. Focus Management across All Question Transitions
  // =========================================================================
  describe("5. Focus Management across All Question Transitions", () => {
    const focusTestCases: Array<{
      cursor: FirstPlanWizardCursor;
      expectedFocusQuery: () => HTMLElement;
      formData?: Partial<PlanEditorFormData>;
    }> = [
      {
        cursor: { section: "basic", question: "title" },
        expectedFocusQuery: () => screen.getByLabelText("여행안 제목 *"),
      },
      {
        cursor: { section: "basic", question: "proposal-reason" },
        expectedFocusQuery: () => screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)"),
      },
      {
        cursor: { section: "basic", question: "headcount" },
        expectedFocusQuery: () => screen.getByRole("group", { name: /비용 기준 인원/ }),
      },
      {
        cursor: { section: "route", question: "city", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("방문 도시 *"),
      },
      {
        cursor: { section: "route", question: "arrival-date", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("도착일 *"),
      },
      {
        cursor: { section: "route", question: "departure-date", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("출발일 *"),
      },
      {
        cursor: { section: "route", question: "add-city", index: 0 },
        expectedFocusQuery: () => screen.getByRole("group", { name: "도시 추가 또는 경로 완료" }),
      },
      {
        cursor: { section: "accommodation", question: "status", index: 0 },
        expectedFocusQuery: () => screen.getByRole("group", { name: "숙소 예약 여부 선택" }),
      },
      {
        cursor: { section: "accommodation", question: "hotel-name", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("숙소명 / 호텔명 *"),
        formData: {
          accommodations: [{ id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "호텔", isSearching: false, bookingStatus: "AVAILABLE" }],
        },
      },
      {
        cursor: { section: "transport", question: "endpoints", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("출발지 *"),
      },
      {
        cursor: { section: "transport", question: "status", index: 0 },
        expectedFocusQuery: () => screen.getByRole("group", { name: "교통편 확인 여부 선택" }),
      },
      {
        cursor: { section: "transport", question: "mode", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("교통수단 *"),
        formData: {
          transports: [{ id: "tr-1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" }],
        },
      },
      {
        cursor: { section: "transport", question: "duration", index: 0 },
        expectedFocusQuery: () => screen.getByLabelText("예상 소요시간 *"),
        formData: {
          transports: [{ id: "tr-1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" }],
        },
      },
    ];

    focusTestCases.forEach(({ cursor, expectedFocusQuery, formData }) => {
      it(`autofocuses target interactive element when navigating to ${cursor.section}/${cursor.question}`, () => {
        const { unmount } = render(
          <FirstPlanWizard cursor={cursor}
            formData={{
              title: "포커스 관리 테스트",
              proposalReason: "",
              baseHeadcount: 2,
              routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
              accommodations: [],
              transports: [],
              ...formData,
            }}
           onNext={vi.fn()} onPrevious={vi.fn()} />
        );

        const targetElement = expectedFocusQuery();
        expect(targetElement).toHaveFocus();
        unmount();
      });
    });
  });

  // =========================================================================
  // 6. Offline and Accessibility State Edge Cases
  // =========================================================================
  describe("6. Offline & Accessibility Live Regions", () => {
    it("renders offline warning message when isOnline is false", () => {
      render(
        <FirstPlanWizard cursor={{ section: "basic", question: "title" }}
          formData={{ title: "오프라인 테스트", proposalReason: "", baseHeadcount: 2, routes: [], accommodations: [], transports: [] }}
          isOnline={false}
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      expect(screen.getByText(OFFLINE_MUTATION_MESSAGE)).toBeInTheDocument();
    });

    it("displays draft save status in polite live region", () => {
      const { rerender } = render(
        <FirstPlanWizard cursor={{ section: "basic", question: "title" }}
          formData={{ title: "저장 상태 테스트", proposalReason: "", baseHeadcount: 2, routes: [], accommodations: [], transports: [] }}
          draftSaveStatus="SAVING"
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      expect(screen.getByRole("status")).toHaveTextContent("자동 저장 중…");

      rerender(
        <FirstPlanWizard cursor={{ section: "basic", question: "title" }}
          formData={{ title: "저장 상태 테스트", proposalReason: "", baseHeadcount: 2, routes: [], accommodations: [], transports: [] }}
          draftSaveStatus="ERROR"
         onNext={vi.fn()} onPrevious={vi.fn()} />
      );

      expect(screen.getByRole("status")).toHaveTextContent("임시 저장하지 못했어요");
    });
  });
});
