import { OFFLINE_MUTATION_MESSAGE } from "@/app/offline-mutation.ts";
import type {
  WizardStepAction,
  WizardStepDraftStatus,
  WizardStepProgress,
} from "@/components/galanda/wizard-step-page.tsx";
import {
  getStayNightCount,
  type AccommodationSnapshot,
  type CityStay,
  type TransportSnapshot,
} from "../../core/domain/room.ts";
import {
  getWizardSubStepProgress,
  type FirstPlanWizardCursor,
  type FirstPlanWizardSection,
} from "./first-plan-wizard-flow.ts";
import {
  getDraftSaveStatusLabel,
  type DraftSaveStatus,
  type PlanEditorFormData,
} from "./plan-editor-model.ts";
import type {
  FirstPlanWizardEvent,
  FirstPlanWizardField,
  FirstPlanWizardQuestionViewModel,
  FirstPlanWizardViewModel,
  WizardRouteSummary,
} from "./first-plan-wizard.contract.ts";

const SECTION_TO_STEP: Record<FirstPlanWizardSection, WizardStepProgress["currentStep"]> = {
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
] as const;

const TRANSPORT_DURATION_PRESETS = [
  "약 30분",
  "약 1시간",
  "약 1시간 30분",
  "약 2시간",
  "약 3시간",
] as const;

export interface FirstPlanWizardPresenterInput {
  readonly cursor: FirstPlanWizardCursor;
  readonly formData: PlanEditorFormData;
  readonly draftSaveStatus: DraftSaveStatus;
  readonly isOnline: boolean;
  readonly touched?: Partial<Record<FirstPlanWizardField, boolean>>;
}

interface QuestionHeaderInfo {
  readonly title: string;
  readonly description: string;
}

const isTouched = (
  touched: FirstPlanWizardPresenterInput["touched"],
  field: FirstPlanWizardField,
): boolean => touched?.[field] === true;

function getQuestionHeaderInfo(
  cursor: FirstPlanWizardCursor,
  routes: ReadonlyArray<CityStay>,
  accommodations: ReadonlyArray<AccommodationSnapshot>,
  transports: ReadonlyArray<TransportSnapshot>,
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
    return {
      title: "몇 명이 함께 떠나는 여행인가요?",
      description: "이 인원을 기준으로 1인 예상 참고액이 자동 계산돼요.",
    };
  }

  if (cursor.section === "route") {
    const index = cursor.index ?? 0;
    const currentRoute = routes[index];
    const previousRoute = index > 0 ? routes[index - 1] : undefined;
    const cityName = currentRoute?.city?.trim() || "도시";

    if (cursor.question === "city") {
      return index === 0
        ? {
            title: "어디로 떠나시나요?",
            description: "방문할 도시와 여행 일정을 순서대로 알려주세요.",
          }
        : {
            title: `${index + 1}번째 방문할 도시는 어디인가요?`,
            description: previousRoute?.city
              ? `이전 방문지(${previousRoute.city}) 다음으로 머물 도시예요.`
              : "다음으로 방문할 도시를 입력해주세요.",
          };
    }
    if (cursor.question === "arrival-date") {
      return {
        title: `${cityName}에 언제 도착하시나요?`,
        description: previousRoute?.departureDate
          ? `이전 도시 출발일(${previousRoute.departureDate}) 이후 날짜를 선택해주세요.`
          : "현지 도착 날짜를 선택해주세요.",
      };
    }
    if (cursor.question === "departure-date") {
      return {
        title: `${cityName}에서 언제 출발하시나요?`,
        description: currentRoute?.arrivalDate
          ? `도착일(${currentRoute.arrivalDate}) 이후의 출발 날짜예요.`
          : "다음 도시로 이동하거나 여행을 마치는 날짜예요.",
      };
    }
    return {
      title: "다른 도시도 방문하시나요?",
      description: "방문하는 도시를 모두 추가하면 맞춤 이동 경로와 숙소를 함께 계획할 수 있어요.",
    };
  }

  if (cursor.section === "accommodation") {
    const index = cursor.index ?? 0;
    const stay = accommodations[index];
    const route = routes[index];
    const cityName = stay?.city?.trim() || route?.city?.trim() || "도시";
    const nights = stay?.nights ?? (route ? Math.max(0, getStayNightCount(route)) : 0);

    return cursor.question === "status"
      ? {
          title: `${cityName} 숙소를 정하셨나요?`,
          description: `구간 ${index + 1} · ${cityName} (${nights}박)의 숙소 정보를 알려주세요.`,
        }
      : {
          title: `${cityName} 숙소 이름을 알려주세요`,
          description: "예약했거나 고려 중인 호텔, 펜션, 게스트하우스 이름을 적어주세요.",
        };
  }

  if (cursor.section === "transport") {
    const index = cursor.index ?? 0;
    const transport = transports[index];
    const totalLegs = Math.max(1, routes.length + 1);
    const fromCity =
      transport?.fromCity?.trim() ||
      (index === 0 ? "출발지" : routes[index - 1]?.city || "출발지");
    const toCity =
      transport?.toCity?.trim() ||
      (index === totalLegs - 1 ? "도착지" : routes[index]?.city || "도착지");

    if (cursor.question === "endpoints") {
      if (index === 0) {
        return {
          title: "출발지와 첫 방문지를 확인해주세요",
          description: routes[0]?.city
            ? `첫 번째 여행지(${routes[0].city})로 가는 이동 구간이에요.`
            : "경로를 바탕으로 제안된 이동 구간이에요.",
        };
      }
      if (index === totalLegs - 1) {
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
        description: `이동 구간 ${index + 1}/${totalLegs}의 교통편 확인 상태를 선택해주세요.`,
      };
    }
    if (cursor.question === "mode") {
      return {
        title: "어떤 교통수단으로 이동하시나요?",
        description: `${fromCity} → ${toCity} 구간의 주요 이동 수단을 입력해주세요.`,
      };
    }
    return {
      title: "예상 소요시간은 얼마나 걸리나요?",
      description: `${fromCity} → ${toCity} 구간의 대략적인 이동 시간을 적어주세요.`,
    };
  }

  return {
    title: "새 여행안 검토",
    description: "작성한 내용을 검토하고 여행안을 제안해주세요.",
  };
}

function getRouteSummary(routes: ReadonlyArray<CityStay>): ReadonlyArray<WizardRouteSummary> {
  return routes.map((route) => ({
    city: route.city,
    arrivalDate: route.arrivalDate,
    departureDate: route.departureDate,
    nights: Math.max(0, getStayNightCount(route)),
  }));
}

function getDraftStatus(status: DraftSaveStatus): WizardStepDraftStatus {
  return {
    label: getDraftSaveStatusLabel(status),
    tone: status === "ERROR" ? "error" : "neutral",
  };
}

function getDisabledReason(
  cursor: FirstPlanWizardCursor,
  values: {
    readonly titleValid: boolean;
    readonly headcountValid: boolean;
    readonly cityValid: boolean;
    readonly arrivalDateValid: boolean;
    readonly departureDateValid: boolean;
    readonly hotelNameValid: boolean;
    readonly endpointsValid: boolean;
    readonly modeValid: boolean;
    readonly durationValid: boolean;
    readonly titleOverLimit: boolean;
    readonly cityOverLimit: boolean;
    readonly arrivalOverlap: boolean;
    readonly departureBeforeOrSame: boolean;
  },
): string | undefined {
  if (cursor.section === "basic") {
    if (cursor.question === "title" && !values.titleValid) {
      return values.titleOverLimit
        ? "여행안 제목은 최대 30자까지 입력할 수 있어요."
        : "여행안 제목을 입력해주세요.";
    }
    if (cursor.question === "headcount" && !values.headcountValid) {
      return "비용 기준 인원은 1~20명으로 입력해주세요.";
    }
    return undefined;
  }
  if (cursor.section === "route") {
    if (cursor.question === "city" && !values.cityValid) {
      return values.cityOverLimit
        ? "도시 이름은 최대 30자까지 입력할 수 있어요."
        : "도시 이름을 입력해주세요.";
    }
    if (cursor.question === "arrival-date" && !values.arrivalDateValid) {
      return values.arrivalOverlap
        ? "도시 체류 일정은 서로 겹칠 수 없습니다."
        : "도착일을 입력해주세요.";
    }
    if (cursor.question === "departure-date" && !values.departureDateValid) {
      return values.departureBeforeOrSame
        ? "출발일은 도착일 이후여야 합니다."
        : "출발일을 입력해주세요.";
    }
    return undefined;
  }
  if (cursor.section === "accommodation") {
    return cursor.question === "hotel-name" && !values.hotelNameValid
      ? "숙소 이름을 입력해주세요."
      : undefined;
  }
  if (cursor.section === "transport") {
    if (cursor.question === "endpoints" && !values.endpointsValid) {
      return "출발지와 도착지를 입력해주세요.";
    }
    if (cursor.question === "mode" && !values.modeValid) {
      return "교통수단을 입력해주세요.";
    }
    if (cursor.question === "duration" && !values.durationValid) {
      return "예상 소요시간을 입력해주세요.";
    }
  }
  return undefined;
}

function createQuestion(
  input: FirstPlanWizardPresenterInput,
): {
  readonly question: FirstPlanWizardQuestionViewModel;
  readonly values: Parameters<typeof getDisabledReason>[1];
} {
  const { cursor, formData, touched } = input;
  const routeIndex = cursor.index ?? 0;
  const currentRoute: CityStay = formData.routes[routeIndex] ?? {
    city: "",
    arrivalDate: "",
    departureDate: "",
  };
  const previousRoute = routeIndex > 0 ? formData.routes[routeIndex - 1] : undefined;
  const currentAccRoute = formData.routes[routeIndex];
  const currentAcc: AccommodationSnapshot = formData.accommodations[routeIndex] ?? {
    id: `acc-${routeIndex + 1}`,
    city: currentAccRoute?.city ?? "",
    period:
      currentAccRoute?.arrivalDate && currentAccRoute.departureDate
        ? `${currentAccRoute.arrivalDate} ~ ${currentAccRoute.departureDate}`
        : "",
    nights: currentAccRoute ? Math.max(0, getStayNightCount(currentAccRoute)) : 0,
    hotelName: "",
    isSearching: true,
    bookingStatus: "NOT_CHECKED",
  };
  const totalLegs = Math.max(1, formData.routes.length + 1);
  const existingTransport = formData.transports[routeIndex];
  const defaultFrom = routeIndex === 0 ? "" : formData.routes[routeIndex - 1]?.city ?? "";
  const defaultTo = routeIndex === totalLegs - 1 ? "" : formData.routes[routeIndex]?.city ?? "";
  const currentTransport: TransportSnapshot = existingTransport ?? {
    id: `tr-${routeIndex + 1}`,
    fromCity: defaultFrom,
    toCity: defaultTo,
    mode: "",
    hasTransfer: false,
    durationText: "",
    bookingStatus: "NOT_CHECKED",
  };
  const fromCity = currentTransport.fromCity || (existingTransport ? "" : defaultFrom);
  const toCity = currentTransport.toCity || (existingTransport ? "" : defaultTo);

  const title = formData.title;
  const trimmedTitle = title.trim();
  const titleOverLimit = trimmedTitle.length > 30;
  const titleValid = trimmedTitle.length >= 1 && !titleOverLimit;
  const headcountValid = formData.baseHeadcount >= 1 && formData.baseHeadcount <= 20;
  const city = currentRoute.city.trim();
  const cityOverLimit = city.length > 30;
  const cityValid = city.length >= 1 && !cityOverLimit;
  const arrivalOverlap = Boolean(
    previousRoute?.departureDate &&
      currentRoute.arrivalDate &&
      currentRoute.arrivalDate < previousRoute.departureDate,
  );
  const arrivalDateValid = Boolean(currentRoute.arrivalDate) && !arrivalOverlap;
  const departureBeforeOrSame = Boolean(
    currentRoute.departureDate &&
      currentRoute.arrivalDate &&
      currentRoute.departureDate <= currentRoute.arrivalDate,
  );
  const departureDateValid = Boolean(currentRoute.departureDate) && !departureBeforeOrSame;
  const hotelNameValid = currentAcc.hotelName.trim().length >= 1;
  const endpointsValid = fromCity.trim().length >= 1 && toCity.trim().length >= 1;
  const modeValid =
    currentTransport.bookingStatus === "NOT_CHECKED" ||
    currentTransport.mode.trim().length >= 1;
  const durationValid =
    currentTransport.bookingStatus === "NOT_CHECKED" ||
    currentTransport.durationText.trim().length >= 1;
  const showTitleError = (isTouched(touched, "title") && !titleValid) || titleOverLimit;
  const showCityError = (isTouched(touched, "city") && !cityValid) || cityOverLimit;
  const showArrivalError =
    (isTouched(touched, "arrival-date") && !arrivalDateValid) || arrivalOverlap;
  const showDepartureError =
    (isTouched(touched, "departure-date") && !departureDateValid) || departureBeforeOrSame;
  const showHotelError = isTouched(touched, "hotel-name") && !hotelNameValid;
  const showModeError = isTouched(touched, "transport-mode") && !modeValid;
  const showDurationError = isTouched(touched, "transport-duration") && !durationValid;

  const values = {
    titleValid,
    headcountValid,
    cityValid,
    arrivalDateValid,
    departureDateValid,
    hotelNameValid,
    endpointsValid,
    modeValid,
    durationValid,
    titleOverLimit,
    cityOverLimit,
    arrivalOverlap,
    departureBeforeOrSame,
  } as const;

  if (cursor.section === "basic") {
    if (cursor.question === "title") {
      return {
        question: {
          kind: "title",
          value: title,
          characterCount: trimmedTitle.length,
          error: showTitleError ? (titleOverLimit ? "여행안 제목은 최대 30자까지 입력할 수 있어요." : "여행안 제목을 입력해주세요.") : undefined,
        },
        values,
      };
    }
    if (cursor.question === "proposal-reason") {
      return {
        question: {
          kind: "proposal-reason",
          value: formData.proposalReason,
          characterCount: formData.proposalReason.length,
        },
        values,
      };
    }
    return { question: { kind: "headcount", value: formData.baseHeadcount }, values };
  }

  if (cursor.section === "route") {
    if (cursor.question === "city") {
      return {
        question: {
          kind: "city",
          index: routeIndex,
          value: currentRoute.city,
          characterCount: city.length,
          error: showCityError ? (cityOverLimit ? "도시 이름은 최대 30자까지 입력할 수 있어요." : "도시 이름을 입력해주세요.") : undefined,
        },
        values,
      };
    }
    if (cursor.question === "arrival-date") {
      return {
        question: {
          kind: "arrival-date",
          index: routeIndex,
          value: currentRoute.arrivalDate,
          min: previousRoute?.departureDate,
          error: showArrivalError
            ? arrivalOverlap
              ? "도시 체류 일정은 서로 겹칠 수 없습니다."
              : "도착일을 입력해주세요."
            : undefined,
        },
        values,
      };
    }
    if (cursor.question === "departure-date") {
      return {
        question: {
          kind: "departure-date",
          index: routeIndex,
          value: currentRoute.departureDate,
          min: currentRoute.arrivalDate,
          nights: Math.max(0, getStayNightCount(currentRoute)),
          error: showDepartureError
            ? departureBeforeOrSame
              ? "출발일은 도착일 이후여야 합니다."
              : "출발일을 입력해주세요."
            : undefined,
        },
        values,
      };
    }
    return { question: { kind: "add-city", routes: getRouteSummary(formData.routes) }, values };
  }

  if (cursor.section === "accommodation") {
    if (cursor.question === "status") {
      return {
        question: {
          kind: "accommodation-status",
          index: routeIndex,
          total: formData.routes.length,
          city: currentAcc.city || currentAccRoute?.city || "도시",
          nights: currentAcc.nights,
          isSearching: currentAcc.isSearching === true,
        },
        values,
      };
    }
    return {
      question: {
        kind: "hotel-name",
        index: routeIndex,
        total: formData.routes.length,
        city: currentAcc.city || currentAccRoute?.city || "도시",
        nights: currentAcc.nights,
        value: currentAcc.hotelName,
        characterCount: currentAcc.hotelName.length,
        error: showHotelError ? "숙소 이름을 입력해주세요." : undefined,
      },
      values,
    };
  }

  if (cursor.section === "transport") {
    if (cursor.question === "endpoints") {
      return {
        question: {
          kind: "transport-endpoints",
          index: routeIndex,
          total: totalLegs,
          fromCity,
          toCity,
          fromError: isTouched(touched, "transport-endpoints") && !fromCity.trim(),
          toError: isTouched(touched, "transport-endpoints") && !toCity.trim(),
        },
        values,
      };
    }
    if (cursor.question === "status") {
      return {
        question: {
          kind: "transport-status",
          index: routeIndex,
          total: totalLegs,
          fromCity: fromCity || "출발지",
          toCity: toCity || "도착지",
          isAvailable: currentTransport.bookingStatus !== "NOT_CHECKED",
        },
        values,
      };
    }
    if (cursor.question === "mode") {
      return {
        question: {
          kind: "transport-mode",
          index: routeIndex,
          total: totalLegs,
          fromCity,
          toCity,
          value: currentTransport.mode,
          characterCount: currentTransport.mode.length,
          error: showModeError ? "교통수단을 입력해주세요." : undefined,
          presets: TRANSPORT_MODE_PRESETS,
        },
        values,
      };
    }
    return {
      question: {
        kind: "transport-duration",
        index: routeIndex,
        total: totalLegs,
        fromCity,
        toCity,
        mode: currentTransport.mode,
        value: currentTransport.durationText,
        characterCount: currentTransport.durationText.length,
        error: showDurationError ? "예상 소요시간을 입력해주세요." : undefined,
        presets: TRANSPORT_DURATION_PRESETS,
      },
      values,
    };
  }

  return {
    question: {
      kind: "title",
      value: title,
      characterCount: trimmedTitle.length,
      error: showTitleError ? "여행안 제목을 입력해주세요." : undefined,
    },
    values,
  };
}

function getPrimaryLabel(
  cursor: FirstPlanWizardCursor,
  formData: PlanEditorFormData,
  proposalReason: string,
  isLastStay: boolean,
  isLastLeg: boolean,
  accommodationIsSearching: boolean,
  transportIsNotChecked: boolean,
): string {
  if (cursor.returnToReview) return "다음";
  if (cursor.section === "basic") {
    if (cursor.question === "proposal-reason" && proposalReason.trim().length === 0) {
      return "건너뛰기";
    }
    if (cursor.question === "headcount") return "다음: 여행 경로";
  }
  if (cursor.section === "route" && cursor.question === "add-city") {
    return (cursor.index ?? 0) + 1 < formData.routes.length ? "다음" : "다음: 숙소";
  }
  if (cursor.section === "accommodation") {
    if (isLastStay && (cursor.question === "status" && accommodationIsSearching || cursor.question === "hotel-name")) {
      return "다음: 교통";
    }
  }
  if (cursor.section === "transport" && isLastLeg && (cursor.question === "duration" || cursor.question === "status" && transportIsNotChecked)) {
    return "입력 내용 검토하기";
  }
  return "다음";
}

export function createFirstPlanWizardViewModel(
  input: FirstPlanWizardPresenterInput,
): FirstPlanWizardViewModel {
  const { cursor, formData } = input;
  const { question, values } = createQuestion(input);
  const header = getQuestionHeaderInfo(
    cursor,
    formData.routes,
    formData.accommodations,
    formData.transports,
  );
  const disabledReason = getDisabledReason(cursor, values);
  const routeIndex = cursor.index ?? 0;
  const stay = formData.accommodations[routeIndex];
  const isLastStay = routeIndex >= formData.routes.length - 1;
  const totalLegs = Math.max(1, formData.routes.length + 1);
  const transport = formData.transports[routeIndex];
  const isLastLeg = routeIndex >= totalLegs - 1;
  const primaryAction: WizardStepAction<FirstPlanWizardEvent> = {
    label: getPrimaryLabel(
      cursor,
      formData,
      formData.proposalReason,
      isLastStay,
      isLastLeg,
      stay ? stay.isSearching === true : true,
      transport ? transport.bookingStatus === "NOT_CHECKED" : true,
    ),
    event: { type: "next" },
    state: disabledReason
      ? { tag: "disabled", reason: disabledReason }
      : { tag: "enabled" },
  };
  const progress = {
    currentStep: SECTION_TO_STEP[cursor.section],
    subStepLabel: SECTION_TO_SUBSTEP_LABEL[cursor.section],
    subStepProgress: getWizardSubStepProgress(cursor, formData),
  } satisfies WizardStepProgress;

  return {
    header,
    progress,
    draftStatus: getDraftStatus(input.draftSaveStatus),
    question,
    actions: {
      primary: primaryAction,
      secondary: {
        label: cursor.returnToReview ? "검토로 돌아가기" : "이전",
        event: { type: "previous" },
        state: { tag: "enabled" },
      },
    },
    notice: input.isOnline
      ? undefined
      : { tone: "info", message: OFFLINE_MUTATION_MESSAGE },
  };
}

export { getQuestionHeaderInfo };
