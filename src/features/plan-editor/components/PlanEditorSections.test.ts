// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getDraftSaveStatusLabel,
  type usePlanEditorState,
} from "../hooks/usePlanEditorState.ts";
import {
  PlanEditorSections,
  RevisionConflictChoice,
} from "./PlanEditorSections.tsx";
import { RouteCitySection } from "./RouteCitySection.tsx";
import { RecommendationIdSchema, RevisionSchema } from "../../../core/domain/ids.ts";

const longDestination =
  "도쿄 중심부와 하코네 산악 지역을 연결하는 아주 긴 방문 도시 이름";
const longBookingUrl =
  "https://booking.example.com/hotels/very-long-destination-name?checkIn=2026-12-10&checkOut=2026-12-12";

const createEditor = (
  overrides: Partial<ReturnType<typeof usePlanEditorState>> = {},
): ReturnType<typeof usePlanEditorState> =>
  ({
    title: "겨울 온천 여행",
    setTitle: vi.fn(),
    proposalReason: "이동을 줄이고 온천에서 쉬는 일정",
    setProposalReason: vi.fn(),
    baseHeadcount: 2,
    setBaseHeadcount: vi.fn(),
    routes: [
      {
        city: longDestination,
        arrivalDate: "2026-12-10",
        departureDate: "2026-12-12",
      },
    ],
    totalTripNights: 2,
    currentTotalNights: 2,
    handleAddCity: vi.fn(),
    handleUpdateCity: vi.fn(),
    handleRemoveCity: vi.fn(),
    accommodations: [
      {
        id: "stay-1",
        city: longDestination,
        period: "2026-12-10 ~ 2026-12-12",
        nights: 2,
        hotelName: "긴 이름의 온천 호텔",
        bookingStatus: "AVAILABLE",
        priceRange: { min: 120_000, max: 180_000 },
        bookingUrl: longBookingUrl,
      },
    ],
    handleAddAccommodation: vi.fn(),
    handleUpdateAccommodation: vi.fn(),
    handleRemoveAccommodation: vi.fn(),
    transports: [
      {
        id: "transport-1",
        fromCity: "서울",
        toCity: longDestination,
        mode: "항공",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
      },
      {
        id: "transport-2",
        fromCity: longDestination,
        toCity: "서울",
        mode: "항공",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
      },
    ],
    handleAddTransport: vi.fn(),
    handleUpdateTransport: vi.fn(),
    handleRemoveTransport: vi.fn(),
    costSummary: {
      hasCost: true,
      minPerPerson: 60_000,
      maxPerPerson: 90_000,
      unpricedCount: 2,
      baseHeadcount: 2,
    },
    validation: {
      isValid: true,
      errorCount: 0,
      errors: [],
    },
    draftSaveStatus: "SAVED",
    clearDraft: vi.fn(),
    discardDraft: vi.fn(),
    draftConflict: false,
    restoreConflictingDraft: vi.fn(),
    useLatestPublishedPlan: vi.fn(),
    replaceFormData: vi.fn(),
    ...overrides,
  }) as unknown as ReturnType<typeof usePlanEditorState>;

describe("PlanEditorSections", () => {
  it("summary는 h1→h2와 semantic opaque list 순서로 긴 destination을 보존한다", () => {
    const editor = createEditor();
    const { container } = render(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        onOpenSection: vi.fn(),
        onCompleteSection: vi.fn(),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "새 여행안 제안하기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "여행안 구성" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading").map((heading) => heading.tagName),
    ).toEqual(["H1", "H2"]);

    const list = screen.getByRole("list", { name: "여행안 편집 항목" });
    expect(list).toHaveAttribute("data-galanda-surface", "content");
    expect(list).toHaveClass("bg-surface-content");
    expect(screen.getByText(new RegExp(longDestination))).toBeInTheDocument();
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(5);
  });

  it("section form은 permanent label, opaque content, long URL/amount와 BottomAction을 유지한다", () => {
    const editor = createEditor();
    const onCompleteSection = vi.fn();
    const view = render(
      createElement(PlanEditorSections, {
        editor,
        section: "basic",
        isEditMode: false,
        isCloneMode: false,
        onOpenSection: vi.fn(),
        onCompleteSection,
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "기본 정보" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "기본 정보 입력" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("여행안 제목 *")).toHaveValue(
      "겨울 온천 여행",
    );
    expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toHaveValue(
      "이동을 줄이고 온천에서 쉬는 일정",
    );
    expect(
      screen.getByRole("group", { name: "비용 기준 인원 *" }),
    ).toHaveAttribute("aria-describedby", "plan-headcount-hint");

    let form = view.container.querySelector("form");
    expect(form).toHaveAttribute("data-galanda-surface", "content");
    expect(form).toHaveClass("bg-surface-content");
    const completeAction = screen.getByRole("button", { name: "편집 완료" });
    expect(
      completeAction.closest('[data-galanda-surface="chrome"]'),
    ).not.toBeNull();
    fireEvent.click(completeAction);
    expect(onCompleteSection).toHaveBeenCalledTimes(1);

    view.rerender(
      createElement(PlanEditorSections, {
        editor,
        section: "accommodation",
        isEditMode: false,
        isCloneMode: false,
        onOpenSection: vi.fn(),
        onCompleteSection,
      }),
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "숙소 체류 구간" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("예약 링크 (선택)")).toHaveValue(
      longBookingUrl,
    );
    expect(screen.getByLabelText("예상 최소 금액(원)")).toHaveValue(120_000);
    expect(screen.getByLabelText("예상 최대 금액(원)")).toHaveValue(180_000);
    expect(screen.getByText(new RegExp(longDestination))).toBeInTheDocument();
    form = view.container.querySelector("form");
    expect(form).toHaveAttribute("data-galanda-surface", "content");
    expect(form).toHaveClass("bg-surface-content");
  });

  it("draft 저장 상태별 문구를 구분한다", () => {
    expect(getDraftSaveStatusLabel("IDLE")).toBe("아직 저장되지 않음");
    expect(getDraftSaveStatusLabel("SAVING")).toBe("자동 저장 중…");
    expect(getDraftSaveStatusLabel("SAVED")).toBe("자동 저장됨");
    expect(getDraftSaveStatusLabel("ERROR")).toBe("임시 저장하지 못했어요");
  });

  it("빈 신규 여행안과 저장 실패를 실제 상태로 표시한다", () => {
    const editor = {
      title: "",
      routes: [],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "ERROR",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );

    expect(html).toContain("임시 저장하지 못했어요");
    expect(html).not.toContain("자동 저장됨");
    expect(html).toContain("방문 도시와 날짜를 정해주세요.");
    expect(html.match(/아직 추가하지 않았어요/g)).toHaveLength(2);
    expect(html.match(/입력 전/g)).toHaveLength(2);
    expect(html).toContain("가격 미정");
    expect(html).not.toContain("숙소 찾는 중");
    expect(html).not.toContain("항공 / KTX");
  });

  it("revision 충돌에서 내 변경 재적용과 최신 공개본 사용을 명시적으로 선택한다", () => {
    const html = renderToStaticMarkup(
      createElement(RevisionConflictChoice, {
        message: "v3에서 v4로 변경됐어요.",
        onReapply: () => undefined,
        onUseLatest: () => undefined,
      }),
    );

    expect(html).toContain("내 변경 다시 적용");
    expect(html).toContain("최신 공개본 사용");
    expect(html).toContain("v3에서 v4로 변경됐어요.");
  });

  it("도시별 날짜 입력과 삭제 행동을 분리해 표시한다", () => {
    const html = renderToStaticMarkup(
      createElement(RouteCitySection, {
        routes: [
          {
            city: "아주 긴 도시 이름",
            arrivalDate: "2026-12-10",
            departureDate: "2026-12-12",
          },
          {
            city: "다음 도시",
            arrivalDate: "2026-12-12",
            departureDate: "2026-12-14",
          },
        ],
        totalTripNights: 4,
        currentTotalNights: 4,
        onAddCity: () => undefined,
        onUpdateCity: () => undefined,
        onRemoveCity: () => undefined,
      }),
    );

    expect(html.match(/type="date"/g)).toHaveLength(4);
    expect(html).toContain('for="route-0-arrival"');
    expect(html).toContain('for="route-0-departure"');
    expect(html).toContain('aria-label="도시 1 삭제"');
    expect(html).toContain('aria-label="도시 2 삭제"');
  });

  it("첫 여행안에서는 진행률과 다음 추천을 안내한다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        isFirstPlan: true,
        recommendedActionId: "DEFINE_ROUTE",
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );

    expect(html).toContain("첫 여행안을 만들어볼까요?");
    expect(html).toContain("필수 정보 1/4 완료");
    expect(html).toContain("다음으로 추천");
    expect(html).toContain("아직 예약하지 않았어도 괜찮아요");

    const fallbackHtml = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        isFirstPlan: true,
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );
    expect(fallbackHtml).toContain("첫 여행안을 만들어볼까요?");
    expect(fallbackHtml).not.toContain("다음으로 추천");
  });

  it("첫 여행안 Journey Hub는 추천·대안·건너뛰기를 기존 section 목록 앞에 둔다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(createElement(PlanEditorSections, {
      editor,
      tripId: "trip-1",
      isEditMode: false,
      isCloneMode: false,
      isFirstPlan: true,
      recommendedActionId: "DEFINE_ROUTE",
      recommendation: {
        recommendationId: RecommendationIdSchema.make("recommendation-1"),
        primary: {
          actionId: "DEFINE_ROUTE",
          reasonCode: "DEFINE_TRAVEL_ROUTE",
        },
        alternatives: [{ actionId: "INVITE_MEMBER" }],
        source: "RULE",
        policyVersion: "nba-rule-v1",
        tripRevision: RevisionSchema.make(1),
        contextFingerprint: "fingerprint",
      },
      onRecommendationAction: () => undefined,
      onOpenSection: () => undefined,
      onCompleteSection: () => undefined,
    }));

    expect(html).toContain("다음으로 하면 좋은 일");
    expect(html).toContain("방문 도시와 날짜를 정하면 다음 계획을 이어갈 수 있어요.");
    expect(html).toContain("여행 경로 정하기");
    expect(html).toContain("대신 친구 초대하기");
    expect(html).toContain("지금은 건너뛰기");
    expect(html.indexOf("다음으로 하면 좋은 일")).toBeLessThan(
      html.indexOf("여행안 편집 항목"),
    );
    expect(html).not.toContain("RULE");
    expect(html).not.toContain("nba-rule-v1");
  });

  it("첫 여행안 recommendation loading은 편집 목록을 막지 않고 primary를 만들지 않는다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(createElement(PlanEditorSections, {
      editor,
      tripId: "trip-1",
      isEditMode: false,
      isCloneMode: false,
      isFirstPlan: true,
      isRecommendationPending: true,
      recommendedActionId: "DEFINE_ROUTE",
      onOpenSection: () => undefined,
      onCompleteSection: () => undefined,
    }));

    expect(html).toContain("여행 상태에 맞는 다음 행동을 확인하고 있어요.");
    expect(html).toContain("여행안 편집 항목");
    expect(html).not.toContain("여행 경로 정하기</button>");
  });

  it("숙소 찾는 중은 domain에서 완료로 취급한다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [
        {
          city: "도쿄",
          arrivalDate: "2026-12-10",
          departureDate: "2026-12-12",
        },
      ],
      accommodations: [
        {
          id: "stay-1",
          city: "도쿄",
          period: "2026-12-10 ~ 2026-12-12",
          nights: 2,
          hotelName: "",
          isSearching: true,
          bookingStatus: "AVAILABLE" as const,
        },
      ],
      transports: [
        {
          id: "t1",
          fromCity: "서울",
          toCity: "도쿄",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE" as const,
        },
        {
          id: "t2",
          fromCity: "도쿄",
          toCity: "서울",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE" as const,
        },
      ],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        isFirstPlan: true,
        recommendedActionId: "PUBLISH_FIRST_PLAN",
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );

    // isSearching이라도 domain상 완료 → 4/4 완료, 다음 추천 없음
    expect(html).toContain("필수 정보 4/4 완료");
    expect(html).not.toContain("다음으로 추천");
    expect(html).not.toContain("숙소 찾는 중");
  });

  it("교통 확인 전(NOT_CHECKED)은 유효한 교통으로 취급한다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [
        {
          city: "도쿄",
          arrivalDate: "2026-12-10",
          departureDate: "2026-12-12",
        },
      ],
      accommodations: [
        {
          id: "stay-1",
          city: "도쿄",
          period: "2026-12-10 ~ 2026-12-12",
          nights: 2,
          hotelName: "도쿄 호텔",
          bookingStatus: "AVAILABLE" as const,
        },
      ],
      transports: [
        {
          id: "t1",
          fromCity: "서울",
          toCity: "도쿄",
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "NOT_CHECKED" as const,
        },
        {
          id: "t2",
          fromCity: "도쿄",
          toCity: "서울",
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "NOT_CHECKED" as const,
        },
      ],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        isFirstPlan: true,
        recommendedActionId: "PUBLISH_FIRST_PLAN",
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );

    // NOT_CHECKED with valid from/to should be considered complete → 4/4 완료
    expect(html).toContain("필수 정보 4/4 완료");
    expect(html).not.toContain("다음으로 추천");
  });

  it("겹치는 도시 일정은 완료로 취급하지 않는다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [
        {
          city: "도쿄",
          arrivalDate: "2026-12-10",
          departureDate: "2026-12-12",
        },
        {
          city: "오사카",
          arrivalDate: "2026-12-11",
          departureDate: "2026-12-14",
        },
      ],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        isFirstPlan: true,
        recommendedActionId: "DEFINE_ROUTE",
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );

    expect(html).toContain("여행 경로");
    expect(html).toContain("다음으로 추천");
    // route should be not complete, so completedCount should be 1/4 (only basic)
    expect(html).toContain("필수 정보 1/4 완료");
  });

  it("도시별 숙소가 누락되면 완료로 취급하지 않는다", () => {
    const editor = {
      title: "첫 여행",
      baseHeadcount: 2,
      routes: [
        {
          city: "도쿄",
          arrivalDate: "2026-12-10",
          departureDate: "2026-12-12",
        },
      ],
      accommodations: [
        {
          id: "stay-1",
          city: "오사카",
          period: "2026-12-10 ~ 2026-12-12",
          nights: 2,
          hotelName: "오사카 호텔",
          bookingStatus: "AVAILABLE" as const,
        },
      ],
      transports: [
        {
          id: "t1",
          fromCity: "서울",
          toCity: "도쿄",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE" as const,
        },
        {
          id: "t2",
          fromCity: "도쿄",
          toCity: "서울",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE" as const,
        },
      ],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(
      createElement(PlanEditorSections, {
        editor,
        isEditMode: false,
        isCloneMode: false,
        isFirstPlan: true,
        recommendedActionId: "ADD_ACCOMMODATION",
        onOpenSection: () => undefined,
        onCompleteSection: () => undefined,
      }),
    );

    expect(html).toContain("숙소");
    expect(html).toContain("다음으로 추천");
    // basic + route + transport complete = 3/4, accommodation incomplete
    expect(html).toContain("필수 정보 3/4 완료");
  });
});
