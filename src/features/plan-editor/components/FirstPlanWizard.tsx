import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils.ts";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import {
  TripCreationProgress,
  type TripCreationStep,
} from "@/components/galanda/trip-creation-progress.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field.tsx";
import { OFFLINE_MUTATION_MESSAGE } from "@/app/offline-mutation.ts";
import {
  getStayNightCount,
  type AccommodationSnapshot,
  type BookingStatus,
  type CityStay,
  type TransportSnapshot,
} from "../../../core/domain/room.ts";
import {
  type FirstPlanWizardCursor,
  type FirstPlanWizardSection,
} from "../first-plan-wizard-flow.ts";
import {
  type DraftSaveStatus,
  type PlanEditorFormData,
  getDraftSaveStatusLabel,
  type usePlanEditorState,
} from "../hooks/usePlanEditorState.ts";

export interface FirstPlanWizardProps {
  readonly cursor: FirstPlanWizardCursor;
  readonly editor?: ReturnType<typeof usePlanEditorState>;
  readonly formData?: PlanEditorFormData;
  readonly draftSaveStatus?: DraftSaveStatus;
  readonly isOnline?: boolean;
  readonly tripId?: string;
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
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onSkip?: () => void;
}

const SECTION_TO_STEP: Record<FirstPlanWizardSection, TripCreationStep> = {
  basic: "plan-basic",
  route: "plan-route",
  accommodation: "plan-accommodation",
  transport: "plan-transport",
  review: "plan-review",
};

const SECTION_TO_SUBSTEP_LABEL: Record<FirstPlanWizardSection, string> = {
  basic: "기본 정보",
  route: "여행 경로",
  accommodation: "숙소",
  transport: "교통",
  review: "검토",
};

const TRANSPORT_MODE_PRESETS = [
  "항공",
  "기차/KTX",
  "렌터카",
  "고속버스",
  "대중교통",
  "선박/페리",
];

const TRANSPORT_DURATION_PRESETS = [
  "약 30분",
  "약 1시간",
  "약 1시간 30분",
  "약 2시간",
  "약 3시간",
];

interface QuestionHeaderInfo {
  readonly title: string;
  readonly description: string;
}

function getQuestionHeaderInfo(
  cursor: FirstPlanWizardCursor,
  routes: ReadonlyArray<CityStay>,
  accommodations: ReadonlyArray<AccommodationSnapshot>,
  transports: ReadonlyArray<TransportSnapshot>
): QuestionHeaderInfo {
  if (cursor.section === "basic") {
    if (cursor.question === "title") {
      return {
        title: "여행안의 이름을 지어주세요",
        description: "어떤 컨셉의 여행인지 친구들이 한눈에 알아볼 수 있게 적어주세요.",
      };
    }
    if (cursor.question === "proposal-reason") {
      return {
        title: "이 여행안을 제안하는 이유가 있나요?",
        description: "선택 사항이에요. 일정의 특징이나 추천 이유를 자유롭게 적어주세요.",
      };
    }
    if (cursor.question === "headcount") {
      return {
        title: "몇 명이 함께 떠나는 여행인가요?",
        description: "이 인원을 기준으로 1인 예상 참고액이 자동 계산돼요.",
      };
    }
  }

  if (cursor.section === "route") {
    const idx = cursor.index ?? 0;
    const currentRoute = routes[idx];
    const prevRoute = idx > 0 ? routes[idx - 1] : undefined;
    const cityName = currentRoute?.city?.trim() || "도시";

    if (cursor.question === "city") {
      if (idx === 0) {
        return {
          title: "어디로 떠나시나요?",
          description: "방문할 도시와 여행 일정을 순서대로 알려주세요.",
        };
      }
      return {
        title: `${idx + 1}번째 방문할 도시는 어디인가요?`,
        description: prevRoute?.city
          ? `이전 방문지(${prevRoute.city}) 다음으로 머물 도시예요.`
          : "다음으로 방문할 도시를 입력해주세요.",
      };
    }

    if (cursor.question === "arrival-date") {
      return {
        title: `${cityName}에 언제 도착하시나요?`,
        description: prevRoute?.departureDate
          ? `이전 도시 출발일(${prevRoute.departureDate}) 이후 날짜를 선택해주세요.`
          : "현지 도착 날짜를 선택해주세요.",
      };
    }

    if (cursor.question === "departure-date") {
      return {
        title: `${cityName}에서 언제 출발하시나요?`,
        description: currentRoute?.arrivalDate
          ? `도착일(${currentRoute.arrivalDate}) 이후의 출발 날짜를 선택해주세요.`
          : "다음 도시로 이동하거나 여행을 마치는 날짜예요.",
      };
    }

    if (cursor.question === "add-city") {
      return {
        title: "다른 도시도 방문하시나요?",
        description: "방문하는 도시를 모두 추가하면 맞춤 이동 경로와 숙소를 함께 계획할 수 있어요.",
      };
    }
  }

  if (cursor.section === "accommodation") {
    const idx = cursor.index ?? 0;
    const stay = accommodations[idx];
    const route = routes[idx];
    const cityName = stay?.city?.trim() || route?.city?.trim() || "도시";
    const nights = stay?.nights ?? (route ? Math.max(0, getStayNightCount(route)) : 0);

    if (cursor.question === "status") {
      return {
        title: `${cityName} 숙소를 정하셨나요?`,
        description: `구간 ${idx + 1} · ${cityName} (${nights}박)의 숙소 정보를 알려주세요.`,
      };
    }

    if (cursor.question === "hotel-name") {
      return {
        title: `${cityName} 숙소 이름을 알려주세요`,
        description: "예약했거나 고려 중인 호텔, 펜션, 게스트하우스 이름을 적어주세요.",
      };
    }
  }

  if (cursor.section === "transport") {
    const idx = cursor.index ?? 0;
    const tr = transports[idx];
    const totalLegs = Math.max(1, routes.length + 1);
    const fromCity = tr?.fromCity?.trim() || (idx === 0 ? "출발지" : routes[idx - 1]?.city || "출발지");
    const toCity = tr?.toCity?.trim() || (idx === totalLegs - 1 ? "도착지" : routes[idx]?.city || "도착지");

    if (cursor.question === "endpoints") {
      if (idx === 0) {
        return {
          title: "출발지와 첫 방문지를 확인해주세요",
          description: routes[0]?.city
            ? `첫 번째 여행지(${routes[0].city})로 가는 이동 구간이에요.`
            : "경로를 바탕으로 제안된 이동 구간이에요.",
        };
      }
      if (idx === totalLegs - 1) {
        return {
          title: "마지막 방문지와 도착지를 확인해주세요",
          description: routes[routes.length - 1]?.city
            ? `${routes[routes.length - 1].city}에서 출발해 돌아오는 도착지를 확인해주세요.`
            : "집으로 돌아오는 귀환 구간이에요.",
        };
      }
      return {
        title: "도시 간 이동 구간을 확인해주세요",
        description: "경로를 바탕으로 제안된 이동 구간이에요. 필요하면 수정할 수 있어요.",
      };
    }

    if (cursor.question === "status") {
      return {
        title: `${fromCity}에서 ${toCity}(으)로 이동할 교통편을 정하셨나요?`,
        description: `이동 구간 ${idx + 1}/${totalLegs}의 교통편 확인 상태를 선택해주세요.`,
      };
    }

    if (cursor.question === "mode") {
      return {
        title: "어떤 교통수단으로 이동하시나요?",
        description: `${fromCity} → ${toCity} 구간의 주요 이동 수단을 입력해주세요.`,
      };
    }

    if (cursor.question === "duration") {
      return {
        title: "예상 소요시간은 얼마나 걸리나요?",
        description: `${fromCity} → ${toCity} 구간의 대략적인 이동 시간을 적어주세요.`,
      };
    }
  }

  return {
    title: "새 여행안 검토",
    description: "작성한 내용을 검토하고 여행안을 제안해주세요.",
  };
}

export function FirstPlanWizard({
  cursor,
  editor,
  formData,
  draftSaveStatus: explicitDraftSaveStatus,
  isOnline = true,
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
  onSkip: _onSkip,
}: FirstPlanWizardProps) {
  const title = editor ? editor.title : (formData?.title ?? "");
  const proposalReason = editor ? editor.proposalReason : (formData?.proposalReason ?? "");
  const baseHeadcount = editor ? editor.baseHeadcount : (formData?.baseHeadcount ?? 2);
  const routes = editor ? editor.routes : (formData?.routes ?? []);
  const accommodations = editor ? editor.accommodations : (formData?.accommodations ?? []);
  const transports = editor ? editor.transports : (formData?.transports ?? []);
  const draftSaveStatus = editor ? editor.draftSaveStatus : (explicitDraftSaveStatus ?? "SAVED");

  // Local touched state for inline error display
  const [titleTouched, setTitleTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [arrivalTouched, setArrivalTouched] = useState(false);
  const [departureTouched, setDepartureTouched] = useState(false);
  const [hotelTouched, setHotelTouched] = useState(false);
  const [endpointsTouched, setEndpointsTouched] = useState(false);
  const [modeTouched, setModeTouched] = useState(false);
  const [durationTouched, setDurationTouched] = useState(false);

  // Focus refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const proposalInputRef = useRef<HTMLInputElement>(null);
  const headcountFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const routeCityInputRef = useRef<HTMLInputElement>(null);
  const routeArrivalInputRef = useRef<HTMLInputElement>(null);
  const routeDepartureInputRef = useRef<HTMLInputElement>(null);
  const routeAddCityFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const accStatusFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const accHotelInputRef = useRef<HTMLInputElement>(null);
  const trEndpointsFromInputRef = useRef<HTMLInputElement>(null);
  const trStatusFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const trModeInputRef = useRef<HTMLInputElement>(null);
  const trDurationInputRef = useRef<HTMLInputElement>(null);

  // Focus management on question/cursor transition
  useEffect(() => {
    if (cursor.section === "basic") {
      if (cursor.question === "title") {
        titleInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "proposal-reason") {
        proposalInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "headcount") {
        headcountFieldsetRef.current?.focus({ preventScroll: true });
      }
    } else if (cursor.section === "route") {
      if (cursor.question === "city") {
        routeCityInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "arrival-date") {
        routeArrivalInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "departure-date") {
        routeDepartureInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "add-city") {
        routeAddCityFieldsetRef.current?.focus({ preventScroll: true });
      }
    } else if (cursor.section === "accommodation") {
      if (cursor.question === "status") {
        accStatusFieldsetRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "hotel-name") {
        accHotelInputRef.current?.focus({ preventScroll: true });
      }
    } else if (cursor.section === "transport") {
      if (cursor.question === "endpoints") {
        trEndpointsFromInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "status") {
        trStatusFieldsetRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "mode") {
        trModeInputRef.current?.focus({ preventScroll: true });
      } else if (cursor.question === "duration") {
        trDurationInputRef.current?.focus({ preventScroll: true });
      }
    }
  }, [cursor.section, cursor.question, cursor.index]);

  // Current entity lookups with defensive fallbacks
  const routeIndex = cursor.index ?? 0;
  const currentRoute: CityStay = routes[routeIndex] ?? { city: "", arrivalDate: "", departureDate: "" };
  const prevRoute: CityStay | undefined = routeIndex > 0 ? routes[routeIndex - 1] : undefined;
  const stayNights = Math.max(0, getStayNightCount(currentRoute));

  const accIndex = cursor.index ?? 0;
  const currentAccRoute = routes[accIndex];
  const currentAcc: AccommodationSnapshot = accommodations[accIndex] ?? {
    id: `acc-${accIndex + 1}`,
    city: currentAccRoute?.city ?? "",
    period: currentAccRoute?.arrivalDate && currentAccRoute?.departureDate
      ? `${currentAccRoute.arrivalDate} ~ ${currentAccRoute.departureDate}`
      : "",
    nights: currentAccRoute ? Math.max(0, getStayNightCount(currentAccRoute)) : 0,
    hotelName: "",
    isSearching: true,
    bookingStatus: "NOT_CHECKED",
  };
  const isLastStay = accIndex >= routes.length - 1;

  const trIndex = cursor.index ?? 0;
  const totalLegs = Math.max(1, routes.length + 1);
  const isLastLeg = trIndex >= totalLegs - 1;

  const defaultProposedFrom = trIndex === 0
    ? ""
    : (routes[trIndex - 1]?.city ?? "");
  const defaultProposedTo = trIndex === totalLegs - 1
    ? ""
    : (routes[trIndex]?.city ?? "");

  const existingTr = transports[trIndex];
  const currentTr: TransportSnapshot = existingTr ?? {
    id: `tr-${trIndex + 1}`,
    fromCity: defaultProposedFrom,
    toCity: defaultProposedTo,
    mode: "",
    hasTransfer: false,
    durationText: "",
    bookingStatus: "NOT_CHECKED",
  };

  const currentTrFrom = currentTr.fromCity || (existingTr ? "" : defaultProposedFrom);
  const currentTrTo = currentTr.toCity || (existingTr ? "" : defaultProposedTo);

  // Field change handlers
  const handleTitleInputChange = (val: string) => {
    if (editor) editor.setTitle(val);
    onTitleChange?.(val);
  };

  const handleProposalInputChange = (val: string) => {
    if (editor) editor.setProposalReason(val);
    onProposalReasonChange?.(val);
  };

  const handleHeadcountDecrement = () => {
    const nextVal = Math.max(1, baseHeadcount - 1);
    if (editor) editor.setBaseHeadcount(nextVal);
    onHeadcountChange?.(nextVal);
  };

  const handleHeadcountIncrement = () => {
    const nextVal = Math.min(20, baseHeadcount + 1);
    if (editor) editor.setBaseHeadcount(nextVal);
    onHeadcountChange?.(nextVal);
  };

  const handleCityInputChange = (index: number, val: string) => {
    if (editor) {
      editor.handleUpdateCity(index, { city: val });
    }
    onCityChange?.(index, val);
  };

  const handleArrivalDateInputChange = (index: number, val: string) => {
    if (editor) {
      editor.handleUpdateCity(index, { arrivalDate: val });
    }
    onArrivalDateChange?.(index, val);
  };

  const handleDepartureDateInputChange = (index: number, val: string) => {
    if (editor) {
      editor.handleUpdateCity(index, { departureDate: val });
    }
    onDepartureDateChange?.(index, val);
  };

  const handleAddCityClick = () => {
    if (onAddCity) {
      onAddCity("");
      return;
    }
    if (editor) {
      editor.handleAddCity("");
    }
  };

  const handleAccommodationStatusSelect = (index: number, isSearching: boolean) => {
    const existing = accommodations[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateAccommodation(existing.id, {
          isSearching,
          bookingStatus: isSearching ? "NOT_CHECKED" : "AVAILABLE",
          hotelName: isSearching ? "" : existing.hotelName,
        });
      } else {
        const route = routes[index];
        editor.handleAddAccommodation({
          id: `acc-${index + 1}`,
          city: route?.city ?? "",
          period: route?.arrivalDate && route?.departureDate ? `${route.arrivalDate} ~ ${route.departureDate}` : "",
          nights: Math.max(0, getStayNightCount(route ?? { city: "", arrivalDate: "", departureDate: "" })),
          hotelName: "",
          isSearching,
          bookingStatus: isSearching ? "NOT_CHECKED" : "AVAILABLE",
        });
      }
    }
    onAccommodationStatusChange?.(index, isSearching);
  };

  const handleHotelNameInputChange = (index: number, val: string) => {
    const existing = accommodations[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateAccommodation(existing.id, { hotelName: val });
      } else {
        const route = routes[index];
        editor.handleAddAccommodation({
          id: `acc-${index + 1}`,
          city: route?.city ?? "",
          period: route?.arrivalDate && route?.departureDate ? `${route.arrivalDate} ~ ${route.departureDate}` : "",
          nights: Math.max(0, getStayNightCount(route ?? { city: "", arrivalDate: "", departureDate: "" })),
          hotelName: val,
          isSearching: false,
          bookingStatus: "AVAILABLE",
        });
      }
    }
    onHotelNameChange?.(index, val);
  };

  const handleTransportFromChange = (index: number, val: string) => {
    const existing = transports[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateTransport(existing.id, { fromCity: val });
      } else {
        editor.handleAddTransport({
          id: `tr-${index + 1}`,
          fromCity: val,
          toCity: defaultProposedTo,
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "NOT_CHECKED",
        });
      }
    }
    onTransportEndpointsChange?.(index, val, currentTrTo);
  };

  const handleTransportToChange = (index: number, val: string) => {
    const existing = transports[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateTransport(existing.id, { toCity: val });
      } else {
        editor.handleAddTransport({
          id: `tr-${index + 1}`,
          fromCity: defaultProposedFrom,
          toCity: val,
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "NOT_CHECKED",
        });
      }
    }
    onTransportEndpointsChange?.(index, currentTrFrom, val);
  };

  const handleTransportStatusSelect = (index: number, bookingStatus: "AVAILABLE" | "NOT_CHECKED") => {
    const existing = transports[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateTransport(existing.id, {
          bookingStatus,
          mode: bookingStatus === "NOT_CHECKED" ? "" : existing.mode,
          durationText: bookingStatus === "NOT_CHECKED" ? "" : existing.durationText,
        });
      } else {
        editor.handleAddTransport({
          id: `tr-${index + 1}`,
          fromCity: currentTrFrom,
          toCity: currentTrTo,
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus,
        });
      }
    }
    onTransportStatusChange?.(index, bookingStatus);
  };

  const handleTransportModeInputChange = (index: number, val: string) => {
    const existing = transports[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateTransport(existing.id, { mode: val });
      } else {
        editor.handleAddTransport({
          id: `tr-${index + 1}`,
          fromCity: currentTrFrom,
          toCity: currentTrTo,
          mode: val,
          hasTransfer: false,
          durationText: "",
          bookingStatus: "AVAILABLE",
        });
      }
    }
    onTransportModeChange?.(index, val);
  };

  const handleTransportDurationInputChange = (index: number, val: string) => {
    const existing = transports[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateTransport(existing.id, { durationText: val });
      } else {
        editor.handleAddTransport({
          id: `tr-${index + 1}`,
          fromCity: currentTrFrom,
          toCity: currentTrTo,
          mode: currentTr.mode,
          hasTransfer: false,
          durationText: val,
          bookingStatus: "AVAILABLE",
        });
      }
    }
    onTransportDurationChange?.(index, val);
  };

  // Validations
  const isTitleValid = title.trim().length >= 1;
  const isHeadcountValid = baseHeadcount >= 1 && baseHeadcount <= 20;
  const isCityValid = currentRoute.city.trim().length >= 1;
  const isArrivalOverlap = Boolean(
    routeIndex > 0 &&
    prevRoute?.departureDate &&
    currentRoute.arrivalDate &&
    currentRoute.arrivalDate < prevRoute.departureDate
  );
  const isArrivalDateValid = Boolean(currentRoute.arrivalDate) && !isArrivalOverlap;
  const isDepartureBeforeOrSame = Boolean(
    currentRoute.departureDate &&
    currentRoute.arrivalDate &&
    currentRoute.departureDate <= currentRoute.arrivalDate
  );
  const isDepartureDateValid = Boolean(currentRoute.departureDate) && !isDepartureBeforeOrSame;
  const isHotelNameValid = currentAcc.hotelName.trim().length >= 1;
  const isEndpointsValid = currentTrFrom.trim().length >= 1 && currentTrTo.trim().length >= 1;
  const isModeValid = currentTr.bookingStatus === "NOT_CHECKED" ? true : currentTr.mode.trim().length >= 1;
  const isDurationValid = currentTr.bookingStatus === "NOT_CHECKED" ? true : currentTr.durationText.trim().length >= 1;

  const isNextValid = (() => {
    if (cursor.section === "basic") {
      if (cursor.question === "title") return isTitleValid;
      if (cursor.question === "headcount") return isHeadcountValid;
      return true;
    }
    if (cursor.section === "route") {
      if (cursor.question === "city") return isCityValid;
      if (cursor.question === "arrival-date") return isArrivalDateValid;
      if (cursor.question === "departure-date") return isDepartureDateValid;
      if (cursor.question === "add-city") return true;
    }
    if (cursor.section === "accommodation") {
      if (cursor.question === "status") return true;
      if (cursor.question === "hotel-name") return isHotelNameValid;
    }
    if (cursor.section === "transport") {
      if (cursor.question === "endpoints") return isEndpointsValid;
      if (cursor.question === "status") return true;
      if (cursor.question === "mode") return isModeValid;
      if (cursor.question === "duration") return isDurationValid;
    }
    return true;
  })();

  const nextButtonLabel = (() => {
    if (cursor.returnToReview) return "다음";
    if (cursor.section === "basic") {
      if (cursor.question === "title") return "다음";
      if (cursor.question === "proposal-reason") {
        return proposalReason.trim().length > 0 ? "다음" : "건너뛰기";
      }
      if (cursor.question === "headcount") return "다음: 여행 경로";
    }
    if (cursor.section === "route") {
      if (cursor.question === "add-city") {
        return routeIndex + 1 < routes.length ? "다음" : "다음: 숙소";
      }
      return "다음";
    }
    if (cursor.section === "accommodation") {
      if (cursor.question === "status" && currentAcc.isSearching && isLastStay) return "다음: 교통";
      if (cursor.question === "hotel-name" && isLastStay) return "다음: 교통";
      return "다음";
    }
    if (cursor.section === "transport") {
      if (cursor.question === "duration" && isLastLeg) return "입력 내용 검토하기";
      if (cursor.question === "status" && currentTr.bookingStatus === "NOT_CHECKED" && isLastLeg) return "입력 내용 검토하기";
      return "다음";
    }
    return "다음";
  })();

  const previousButtonLabel = cursor.returnToReview ? "검토로 돌아가기" : "이전";

  // IME-safe Keyboard Enter Handlers
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isTitleValid) onNext();
      else setTitleTouched(true);
    }
  };

  const handleProposalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      onNext();
    }
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isCityValid) onNext();
      else setCityTouched(true);
    }
  };

  const handleArrivalDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isArrivalDateValid) onNext();
      else setArrivalTouched(true);
    }
  };

  const handleDepartureDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isDepartureDateValid) onNext();
      else setDepartureTouched(true);
    }
  };

  const handleHotelNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isHotelNameValid) onNext();
      else setHotelTouched(true);
    }
  };

  const handleTransportEndpointsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isEndpointsValid) onNext();
      else setEndpointsTouched(true);
    }
  };

  const handleTransportModeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isModeValid) onNext();
      else setModeTouched(true);
    }
  };

  const handleTransportDurationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (isDurationValid) onNext();
      else setDurationTouched(true);
    }
  };

  const handleNext = () => {
    if (cursor.section === "accommodation" && cursor.question === "status") {
      if (!accommodations[accIndex]) {
        handleAccommodationStatusSelect(accIndex, true);
      }
    }
    onNext();
  };

  const headerInfo = getQuestionHeaderInfo(cursor, routes, accommodations, transports);

  // Field error visibility flags
  const showTitleError = titleTouched && !isTitleValid;
  const showCityError = cityTouched && !isCityValid;
  const showArrivalError = arrivalTouched && !isArrivalDateValid;
  const showDepartureError = departureTouched && !isDepartureDateValid;
  const showHotelError = hotelTouched && !isHotelNameValid;
  const showEndpointsError = endpointsTouched && !isEndpointsValid;
  const showModeError = modeTouched && !isModeValid;
  const showDurationError = durationTouched && !isDurationValid;

  return (
    <div data-galanda-surface="content" className="flex min-h-dvh flex-1 flex-col">
      <PageBody withBottomAction className="flex flex-1 flex-col max-w-(--content-max-width)">
        <TripCreationProgress
          currentStep={SECTION_TO_STEP[cursor.section]}
          subStepLabel={SECTION_TO_SUBSTEP_LABEL[cursor.section]}
          className="mx-(--app-inline-padding) mt-1"
        />

        <PageTitle
          title={headerInfo.title}
          description={headerInfo.description}
          action={
            <output
              data-slot="draft-save-status"
              aria-live="polite"
              className={cn(
                "flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium [overflow-wrap:anywhere]",
                draftSaveStatus === "ERROR"
                  ? "bg-destructive/10 text-destructive font-semibold"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {getDraftSaveStatusLabel(draftSaveStatus)}
            </output>
          }
          className="mt-1"
        />

        {/* 1. Basic Questions */}
        {cursor.section === "basic" && cursor.question === "title" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isTitleValid) onNext();
              else setTitleTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <Field data-invalid={showTitleError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-plan-title" className="text-base font-semibold text-foreground">
                여행안 제목 *
              </FieldLabel>
              <Input
                id="wizard-plan-title"
                ref={titleInputRef}
                type="text"
                placeholder="예: 힐링 카페 & 호캉스 코스"
                value={title}
                maxLength={30}
                onChange={(e) => handleTitleInputChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={() => setTitleTouched(true)}
                aria-describedby="wizard-title-help"
                aria-invalid={showTitleError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showTitleError ? (
                <FieldError id="wizard-title-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">여행안 제목을 입력해주세요.</span>
                  <span className="shrink-0 tabular-nums">{`${title.length}/30`}</span>
                </FieldError>
              ) : (
                <FieldDescription id="wizard-title-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{`${title.length}/30`}</span>
                </FieldDescription>
              )}
            </Field>
          </form>
        )}

        {cursor.section === "basic" && cursor.question === "proposal-reason" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              onNext();
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <Field className="gap-3">
              <FieldLabel htmlFor="wizard-plan-proposal-reason" className="text-base font-semibold text-foreground">
                제안 이유 / 한 줄 요약 (선택)
              </FieldLabel>
              <Input
                id="wizard-plan-proposal-reason"
                ref={proposalInputRef}
                type="text"
                placeholder="예: 이동을 줄이고 서귀포 호텔에서 여유를 즐기는 안"
                value={proposalReason}
                maxLength={100}
                onChange={(e) => handleProposalInputChange(e.target.value)}
                onKeyDown={handleProposalKeyDown}
                aria-describedby="wizard-proposal-reason-help"
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              <FieldDescription id="wizard-proposal-reason-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">작성하지 않고 바로 다음으로 넘어가도 괜찮아요.</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{`${proposalReason.length}/100`}</span>
              </FieldDescription>
            </Field>
          </form>
        )}

        {cursor.section === "basic" && cursor.question === "headcount" && (
          <div className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <fieldset
              ref={headcountFieldsetRef}
              tabIndex={-1}
              className="m-0 flex min-w-0 flex-col gap-4 border-none p-0 outline-none"
              aria-describedby="wizard-headcount-hint"
            >
              <legend className="text-base font-semibold text-foreground">
                비용 기준 인원 *
              </legend>

              <div className="flex items-center gap-4 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 rounded-xl text-xl font-bold"
                  aria-label="비용 기준 인원 한 명 줄이기"
                  disabled={baseHeadcount <= 1}
                  onClick={handleHeadcountDecrement}
                >
                  <span aria-hidden="true">-</span>
                </Button>

                <span
                  className="min-w-20 text-center text-2xl font-bold tabular-nums text-foreground"
                  aria-live="polite"
                >
                  {baseHeadcount}명
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 rounded-xl text-xl font-bold"
                  aria-label="비용 기준 인원 한 명 늘리기"
                  disabled={baseHeadcount >= 20}
                  onClick={handleHeadcountIncrement}
                >
                  <span aria-hidden="true">+</span>
                </Button>
              </div>

              <p
                id="wizard-headcount-hint"
                className="text-sm font-normal leading-relaxed text-muted-foreground"
              >
                이 인원을 기준으로 숙소와 교통의 1인 예상 참고액이 자동 계산됩니다. (1~20명)
              </p>
            </fieldset>
          </div>
        )}

        {/* 2. Route Questions */}
        {cursor.section === "route" && cursor.question === "city" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isCityValid) onNext();
              else setCityTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <Field data-invalid={showCityError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-route-city" className="text-base font-semibold text-foreground">
                방문 도시 *
              </FieldLabel>
              <Input
                id="wizard-route-city"
                ref={routeCityInputRef}
                type="text"
                placeholder="예: 제주시 / 도쿄 / 파리"
                value={currentRoute.city}
                maxLength={30}
                onChange={(e) => handleCityInputChange(routeIndex, e.target.value)}
                onKeyDown={handleCityKeyDown}
                onBlur={() => setCityTouched(true)}
                aria-describedby="wizard-route-city-help"
                aria-invalid={showCityError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showCityError ? (
                <FieldError id="wizard-route-city-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">도시 이름을 입력해주세요.</span>
                  <span className="shrink-0 tabular-nums">{`${currentRoute.city.length}/30`}</span>
                </FieldError>
              ) : (
                <FieldDescription id="wizard-route-city-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{`${currentRoute.city.length}/30`}</span>
                </FieldDescription>
              )}
            </Field>
          </form>
        )}

        {cursor.section === "route" && cursor.question === "arrival-date" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isArrivalDateValid) onNext();
              else setArrivalTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <Field data-invalid={showArrivalError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-route-arrival-date" className="text-base font-semibold text-foreground">
                도착일 *
              </FieldLabel>
              <Input
                id="wizard-route-arrival-date"
                ref={routeArrivalInputRef}
                type="date"
                value={currentRoute.arrivalDate}
                min={prevRoute?.departureDate}
                onChange={(e) => handleArrivalDateInputChange(routeIndex, e.target.value)}
                onKeyDown={handleArrivalDateKeyDown}
                onBlur={() => setArrivalTouched(true)}
                aria-describedby="wizard-route-arrival-help"
                aria-invalid={showArrivalError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showArrivalError ? (
                <FieldError id="wizard-route-arrival-help">
                  {isArrivalOverlap
                    ? "도시 체류 일정은 서로 겹칠 수 없습니다."
                    : "도착일을 입력해주세요."}
                </FieldError>
              ) : (
                <FieldDescription id="wizard-route-arrival-help">
                  도착 날짜를 선택해주세요. (YYYY-MM-DD)
                </FieldDescription>
              )}
            </Field>
          </form>
        )}

        {cursor.section === "route" && cursor.question === "departure-date" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isDepartureDateValid) onNext();
              else setDepartureTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <Field data-invalid={showDepartureError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-route-departure-date" className="text-base font-semibold text-foreground">
                출발일 *
              </FieldLabel>
              <Input
                id="wizard-route-departure-date"
                ref={routeDepartureInputRef}
                type="date"
                value={currentRoute.departureDate}
                min={currentRoute.arrivalDate}
                onChange={(e) => handleDepartureDateInputChange(routeIndex, e.target.value)}
                onKeyDown={handleDepartureDateKeyDown}
                onBlur={() => setDepartureTouched(true)}
                aria-describedby="wizard-route-departure-help"
                aria-invalid={showDepartureError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showDepartureError ? (
                <FieldError id="wizard-route-departure-help">
                  {isDepartureBeforeOrSame
                    ? "출발일은 도착일 이후여야 합니다."
                    : "출발일을 입력해주세요."}
                </FieldError>
              ) : (
                <FieldDescription id="wizard-route-departure-help">
                  {isDepartureDateValid
                    ? `체류 기간: ${stayNights}박 (${stayNights}박 ${stayNights + 1}일 일정)`
                    : "도착일 이후의 출발 날짜를 선택해주세요."}
                </FieldDescription>
              )}
            </Field>
          </form>
        )}

        {cursor.section === "route" && cursor.question === "add-city" && (
          <div className="mx-(--app-inline-padding) mt-3 flex flex-col gap-4">
            <fieldset
              ref={routeAddCityFieldsetRef}
              tabIndex={-1}
              className="m-0 flex min-w-0 flex-col gap-4 border-none p-0 outline-none"
            >
              <legend className="sr-only">도시 추가 또는 경로 완료</legend>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">현재 여행 경로</h3>
                <div className="flex flex-col gap-2">
                  {routes.map((r, k) => {
                    const nights = Math.max(0, getStayNightCount(r));
                    return (
                      <div
                        key={`route-summary-${k}`}
                        className="flex items-center justify-between rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm"
                      >
                        <span className="font-semibold text-foreground">
                          도시 {k + 1} · {r.city || "미정"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {r.arrivalDate && r.departureDate ? `${r.arrivalDate} ~ ${r.departureDate}` : ""} ({nights}박)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full rounded-2xl border-2 border-dashed py-4 font-semibold text-primary hover:bg-primary/5"
                onClick={handleAddCityClick}
              >
                + 도시 추가하기
              </Button>
            </fieldset>
          </div>
        )}

        {/* 3. Accommodation Questions */}
        {cursor.section === "accommodation" && cursor.question === "status" && (
          <div className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <fieldset
              ref={accStatusFieldsetRef}
              tabIndex={-1}
              className="m-0 flex min-w-0 flex-col gap-3 border-none p-0 outline-none"
              aria-describedby="wizard-acc-status-badge"
            >
              <legend className="sr-only">숙소 예약 여부 선택</legend>
              <div id="wizard-acc-status-badge" className="text-xs font-semibold text-primary">
                구간 {accIndex + 1}/{routes.length} · {currentAcc.city || currentAccRoute?.city || "도시"} ({currentAcc.nights}박)
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!currentAcc.isSearching}
                  onClick={() => handleAccommodationStatusSelect(accIndex, false)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors cursor-pointer",
                    !currentAcc.isSearching
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-base font-bold text-foreground">정했어요</span>
                  <span className="text-sm text-muted-foreground">숙소 이름과 예약 정보를 입력해요.</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={currentAcc.isSearching}
                  onClick={() => handleAccommodationStatusSelect(accIndex, true)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors cursor-pointer",
                    currentAcc.isSearching
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-base font-bold text-foreground">알아보는 중</span>
                  <span className="text-sm text-muted-foreground">아직 예약하지 않았거나 찾는 중이에요.</span>
                </button>
              </div>
            </fieldset>
          </div>
        )}

        {cursor.section === "accommodation" && cursor.question === "hotel-name" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isHotelNameValid) onNext();
              else setHotelTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="mb-2 text-xs font-semibold text-primary">
              구간 {accIndex + 1}/{routes.length} · {currentAcc.city || currentAccRoute?.city || "도시"} ({currentAcc.nights}박)
            </div>
            <Field data-invalid={showHotelError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-hotel-name" className="text-base font-semibold text-foreground">
                숙소명 / 호텔명 *
              </FieldLabel>
              <Input
                id="wizard-hotel-name"
                ref={accHotelInputRef}
                type="text"
                placeholder="예: 그랜드 조선 호텔 제주 / 신라호텔"
                value={currentAcc.hotelName}
                maxLength={50}
                onChange={(e) => handleHotelNameInputChange(accIndex, e.target.value)}
                onKeyDown={handleHotelNameKeyDown}
                onBlur={() => setHotelTouched(true)}
                aria-describedby="wizard-hotel-name-help"
                aria-invalid={showHotelError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showHotelError ? (
                <FieldError id="wizard-hotel-name-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">숙소 이름을 입력해주세요.</span>
                  <span className="shrink-0 tabular-nums">{`${currentAcc.hotelName.length}/50`}</span>
                </FieldError>
              ) : (
                <FieldDescription id="wizard-hotel-name-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">최대 50자까지 입력할 수 있어요.</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{`${currentAcc.hotelName.length}/50`}</span>
                </FieldDescription>
              )}
            </Field>
          </form>
        )}

        {/* 4. Transport Questions */}
        {cursor.section === "transport" && cursor.question === "endpoints" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isEndpointsValid) onNext();
              else setEndpointsTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="mb-2 text-xs font-semibold text-primary">
              이동 {trIndex + 1}/{totalLegs}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={endpointsTouched && !currentTrFrom.trim() || undefined} className="gap-2">
                <FieldLabel htmlFor="wizard-transport-from" className="text-sm font-semibold text-foreground">
                  출발지 *
                </FieldLabel>
                <Input
                  id="wizard-transport-from"
                  ref={trEndpointsFromInputRef}
                  type="text"
                  placeholder={trIndex === 0 ? "예: 서울 / 김포 / 인천" : routes[trIndex - 1]?.city || "출발지"}
                  value={currentTrFrom}
                  maxLength={30}
                  onChange={(e) => handleTransportFromChange(trIndex, e.target.value)}
                  onKeyDown={handleTransportEndpointsKeyDown}
                  onBlur={() => setEndpointsTouched(true)}
                  className="h-12 rounded-xl border-border bg-background px-4 text-base"
                />
              </Field>

              <Field data-invalid={endpointsTouched && !currentTrTo.trim() || undefined} className="gap-2">
                <FieldLabel htmlFor="wizard-transport-to" className="text-sm font-semibold text-foreground">
                  도착지 *
                </FieldLabel>
                <Input
                  id="wizard-transport-to"
                  type="text"
                  placeholder={trIndex === totalLegs - 1 ? "예: 서울 / 김포 / 집" : routes[trIndex]?.city || "도착지"}
                  value={currentTrTo}
                  maxLength={30}
                  onChange={(e) => handleTransportToChange(trIndex, e.target.value)}
                  onKeyDown={handleTransportEndpointsKeyDown}
                  onBlur={() => setEndpointsTouched(true)}
                  className="h-12 rounded-xl border-border bg-background px-4 text-base"
                />
              </Field>
            </div>

            {showEndpointsError && (
              <p className="mt-3 text-xs font-semibold text-destructive">
                출발지와 도착지를 모두 입력해주세요.
              </p>
            )}
          </form>
        )}

        {cursor.section === "transport" && cursor.question === "status" && (
          <div className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <fieldset
              ref={trStatusFieldsetRef}
              tabIndex={-1}
              className="m-0 flex min-w-0 flex-col gap-3 border-none p-0 outline-none"
              aria-describedby="wizard-tr-status-badge"
            >
              <legend className="sr-only">교통편 확인 여부 선택</legend>
              <div id="wizard-tr-status-badge" className="text-xs font-semibold text-primary">
                이동 {trIndex + 1}/{totalLegs} · {currentTrFrom || "출발지"} → {currentTrTo || "도착지"}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={currentTr.bookingStatus !== "NOT_CHECKED"}
                  onClick={() => handleTransportStatusSelect(trIndex, "AVAILABLE")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors cursor-pointer",
                    currentTr.bookingStatus !== "NOT_CHECKED"
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-base font-bold text-foreground">정했어요</span>
                  <span className="text-sm text-muted-foreground">교통수단과 소요 시간을 입력해요.</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={currentTr.bookingStatus === "NOT_CHECKED"}
                  onClick={() => handleTransportStatusSelect(trIndex, "NOT_CHECKED")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors cursor-pointer",
                    currentTr.bookingStatus === "NOT_CHECKED"
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-base font-bold text-foreground">아직 안 정함</span>
                  <span className="text-sm text-muted-foreground">교통편 확인 전으로 남겨둘게요.</span>
                </button>
              </div>
            </fieldset>
          </div>
        )}

        {cursor.section === "transport" && cursor.question === "mode" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isModeValid) onNext();
              else setModeTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="mb-2 text-xs font-semibold text-primary">
              이동 {trIndex + 1}/{totalLegs} · {currentTrFrom} → {currentTrTo}
            </div>
            <Field data-invalid={showModeError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-transport-mode" className="text-base font-semibold text-foreground">
                교통수단 *
              </FieldLabel>

              <div className="flex flex-wrap gap-2">
                {TRANSPORT_MODE_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(
                      "rounded-full px-3 text-xs font-medium",
                      currentTr.mode === preset && "bg-primary text-primary-foreground font-semibold"
                    )}
                    onClick={() => handleTransportModeInputChange(trIndex, preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              <Input
                id="wizard-transport-mode"
                ref={trModeInputRef}
                type="text"
                placeholder="예: 항공편 / KTX / 렌터카 / 고속버스"
                value={currentTr.mode}
                maxLength={30}
                onChange={(e) => handleTransportModeInputChange(trIndex, e.target.value)}
                onKeyDown={handleTransportModeKeyDown}
                onBlur={() => setModeTouched(true)}
                aria-describedby="wizard-transport-mode-help"
                aria-invalid={showModeError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showModeError ? (
                <FieldError id="wizard-transport-mode-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">교통수단을 입력해주세요.</span>
                  <span className="shrink-0 tabular-nums">{`${currentTr.mode.length}/30`}</span>
                </FieldError>
              ) : (
                <FieldDescription id="wizard-transport-mode-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{`${currentTr.mode.length}/30`}</span>
                </FieldDescription>
              )}
            </Field>
          </form>
        )}

        {cursor.section === "transport" && cursor.question === "duration" && (
          <form
            id="wizard-question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (isDurationValid) onNext();
              else setDurationTouched(true);
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="mb-2 text-xs font-semibold text-primary">
              이동 {trIndex + 1}/{totalLegs} · {currentTrFrom} → {currentTrTo} ({currentTr.mode || "교통"})
            </div>
            <Field data-invalid={showDurationError || undefined} className="gap-3">
              <FieldLabel htmlFor="wizard-transport-duration" className="text-base font-semibold text-foreground">
                예상 소요시간 *
              </FieldLabel>

              <div className="flex flex-wrap gap-2">
                {TRANSPORT_DURATION_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(
                      "rounded-full px-3 text-xs font-medium",
                      currentTr.durationText === preset && "bg-primary text-primary-foreground font-semibold"
                    )}
                    onClick={() => handleTransportDurationInputChange(trIndex, preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              <Input
                id="wizard-transport-duration"
                ref={trDurationInputRef}
                type="text"
                placeholder="예: 약 1시간 10분 / 2시간 30분 / 45분"
                value={currentTr.durationText}
                maxLength={30}
                onChange={(e) => handleTransportDurationInputChange(trIndex, e.target.value)}
                onKeyDown={handleTransportDurationKeyDown}
                onBlur={() => setDurationTouched(true)}
                aria-describedby="wizard-transport-duration-help"
                aria-invalid={showDurationError || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {showDurationError ? (
                <FieldError id="wizard-transport-duration-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">예상 소요시간을 입력해주세요.</span>
                  <span className="shrink-0 tabular-nums">{`${currentTr.durationText.length}/30`}</span>
                </FieldError>
              ) : (
                <FieldDescription id="wizard-transport-duration-help" className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{`${currentTr.durationText.length}/30`}</span>
                </FieldDescription>
              )}
            </Field>
          </form>
        )}
      </PageBody>

      <BottomAction
        surface="content"
        className="border-border"
        accessory={
          !isOnline ? (
            <output aria-live="polite" className="block text-center text-sm text-muted-foreground">
              {OFFLINE_MUTATION_MESSAGE}
            </output>
          ) : undefined
        }
      >
        <Button
          type="button"
          size="xl"
          variant="secondary"
          onClick={onPrevious}
        >
          {previousButtonLabel}
        </Button>
        <Button
          type="button"
          size="xl"
          disabled={!isNextValid}
          onClick={handleNext}
        >
          {nextButtonLabel}
        </Button>
      </BottomAction>
    </div>
  );
}
