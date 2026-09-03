import type { PlanEditorFormData } from "./hooks/usePlanEditorState.ts";

export const FIRST_PLAN_WIZARD_SECTIONS = [
  "basic",
  "route",
  "accommodation",
  "transport",
  "review",
] as const;

export type FirstPlanWizardSection = (typeof FIRST_PLAN_WIZARD_SECTIONS)[number];

export type FirstPlanWizardBasicQuestion =
  | "title"
  | "proposal-reason"
  | "headcount";

export type FirstPlanWizardRouteQuestion =
  | "city"
  | "arrival-date"
  | "departure-date"
  | "add-city";

export type FirstPlanWizardAccommodationQuestion =
  | "status"
  | "hotel-name";

export type FirstPlanWizardTransportQuestion =
  | "endpoints"
  | "status"
  | "mode"
  | "duration";

export type FirstPlanWizardQuestion =
  | FirstPlanWizardBasicQuestion
  | FirstPlanWizardRouteQuestion
  | FirstPlanWizardAccommodationQuestion
  | FirstPlanWizardTransportQuestion;

export const FIRST_PLAN_WIZARD_QUESTIONS: ReadonlyArray<FirstPlanWizardQuestion> = [
  "title",
  "proposal-reason",
  "headcount",
  "city",
  "arrival-date",
  "departure-date",
  "add-city",
  "status",
  "hotel-name",
  "endpoints",
  "mode",
  "duration",
] as const;

export interface FirstPlanWizardCursor {
  readonly section: FirstPlanWizardSection;
  readonly question: FirstPlanWizardQuestion;
  readonly index?: number;
  readonly returnToReview?: boolean;
}

export function isFirstPlanWizardSection(value: unknown): value is FirstPlanWizardSection {
  return typeof value === "string" && (FIRST_PLAN_WIZARD_SECTIONS as readonly string[]).includes(value);
}

export function isFirstPlanWizardQuestion(value: unknown): value is FirstPlanWizardQuestion {
  return typeof value === "string" && (FIRST_PLAN_WIZARD_QUESTIONS as readonly string[]).includes(value);
}

export const FIRST_PLAN_SECTION_DEFAULT_QUESTIONS: Record<FirstPlanWizardSection, FirstPlanWizardQuestion> = {
  basic: "title",
  route: "city",
  accommodation: "status",
  transport: "endpoints",
  review: "title",
};

export function parseWizardCursor(
  searchParams: URLSearchParams,
  pathname: string
): FirstPlanWizardCursor {
  const normalizedPath = pathname.replace(/\/+$/, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  const newIndex = segments.indexOf("new");

  let section: FirstPlanWizardSection = "basic";
  if (newIndex !== -1) {
    const afterNew = segments[newIndex + 1];
    if (!afterNew) {
      section = "review";
    } else if (isFirstPlanWizardSection(afterNew)) {
      section = afterNew;
    }
  }

  const rawQuestion = searchParams.get("question");
  const question: FirstPlanWizardQuestion = isFirstPlanWizardQuestion(rawQuestion)
    ? rawQuestion
    : FIRST_PLAN_SECTION_DEFAULT_QUESTIONS[section];

  const rawIndex = searchParams.get("index");
  let index: number | undefined;
  if (section === "route" || section === "accommodation" || section === "transport") {
    if (rawIndex !== null && /^\d+$/.test(rawIndex)) {
      index = parseInt(rawIndex, 10);
    } else {
      index = 0;
    }
  }

  const returnToReview = searchParams.get("returnToReview") === "true" ? true : undefined;

  return {
    section,
    question,
    ...(index !== undefined ? { index } : {}),
    ...(returnToReview ? { returnToReview: true } : {}),
  };
}

export function serializeWizardCursor(
  cursor: FirstPlanWizardCursor,
  tripId: string
): { pathname: string; search: string } {
  if (cursor.section === "review") {
    return {
      pathname: `/trips/${tripId}/plans/new`,
      search: "",
    };
  }

  const pathname = `/trips/${tripId}/plans/new/${cursor.section}`;
  const params = new URLSearchParams();
  params.set("question", cursor.question);

  if (cursor.index !== undefined && cursor.section !== "basic") {
    params.set("index", String(cursor.index));
  }

  if (cursor.returnToReview) {
    params.set("returnToReview", "true");
  }

  return {
    pathname,
    search: `?${params.toString()}`,
  };
}

export function normalizeWizardCursor(
  cursor: Partial<FirstPlanWizardCursor>,
  formData: PlanEditorFormData
): FirstPlanWizardCursor {
  let section: FirstPlanWizardSection = isFirstPlanWizardSection(cursor.section)
    ? cursor.section
    : "basic";

  if ((section === "accommodation" || section === "transport") && formData.routes.length === 0) {
    section = "route";
  }

  let question: FirstPlanWizardQuestion = cursor.question && isFirstPlanWizardQuestion(cursor.question)
    ? cursor.question
    : FIRST_PLAN_SECTION_DEFAULT_QUESTIONS[section];
  let index: number | undefined;

  switch (section) {
    case "basic": {
      if (!["title", "proposal-reason", "headcount"].includes(question)) {
        question = "title";
      }
      index = undefined;
      break;
    }
    case "route": {
      if (!["city", "arrival-date", "departure-date", "add-city"].includes(question)) {
        question = "city";
      }
      const maxRouteIndex = Math.max(0, formData.routes.length - 1);
      const rawIdx = typeof cursor.index === "number" && !Number.isNaN(cursor.index) ? cursor.index : 0;
      index = Math.max(0, Math.min(rawIdx, maxRouteIndex));
      break;
    }
    case "accommodation": {
      if (!["status", "hotel-name"].includes(question)) {
        question = "status";
      }
      const maxAccIndex = Math.max(0, formData.routes.length - 1);
      const rawIdx = typeof cursor.index === "number" && !Number.isNaN(cursor.index) ? cursor.index : 0;
      index = Math.max(0, Math.min(rawIdx, maxAccIndex));

      const stay = formData.accommodations[index];
      const isSearching = stay ? stay.isSearching === true : true;
      if (question === "hotel-name" && isSearching) {
        question = "status";
      }
      break;
    }
    case "transport": {
      if (!["endpoints", "status", "mode", "duration"].includes(question)) {
        question = "endpoints";
      }
      const maxTransportIndex = formData.routes.length;
      const rawIdx = typeof cursor.index === "number" && !Number.isNaN(cursor.index) ? cursor.index : 0;
      index = Math.max(0, Math.min(rawIdx, maxTransportIndex));

      if (
        (question === "mode" || question === "duration") &&
        formData.transports[index]?.bookingStatus === "NOT_CHECKED"
      ) {
        question = "status";
      }
      break;
    }
    case "review": {
      question = "title";
      index = undefined;
      break;
    }
  }

  return {
    section,
    question,
    ...(index !== undefined ? { index } : {}),
    ...(cursor.returnToReview ? { returnToReview: true } : {}),
  };
}

export function getNextWizardCursor(
  currentCursor: FirstPlanWizardCursor,
  formData: PlanEditorFormData
): FirstPlanWizardCursor {
  const norm = normalizeWizardCursor(currentCursor, formData);

  if (norm.returnToReview) {
    if (norm.section === "basic") {
      return { section: "review", question: "title" };
    }
    if (norm.section === "route") {
      const idx = norm.index ?? 0;
      if (norm.question === "city") {
        return { section: "route", question: "arrival-date", index: idx, returnToReview: true };
      }
      if (norm.question === "arrival-date") {
        return { section: "route", question: "departure-date", index: idx, returnToReview: true };
      }
      return { section: "review", question: "title" };
    }
    if (norm.section === "accommodation") {
      const idx = norm.index ?? 0;
      if (norm.question === "status") {
        const stay = formData.accommodations[idx];
        if (stay && !stay.isSearching) {
          return { section: "accommodation", question: "hotel-name", index: idx, returnToReview: true };
        }
      }
      return { section: "review", question: "title" };
    }
    if (norm.section === "transport") {
      const idx = norm.index ?? 0;
      if (norm.question === "endpoints") {
        return { section: "transport", question: "status", index: idx, returnToReview: true };
      }
      if (norm.question === "status") {
        const tr = formData.transports[idx];
        if (tr && tr.bookingStatus !== "NOT_CHECKED") {
          return { section: "transport", question: "mode", index: idx, returnToReview: true };
        }
      }
      if (norm.question === "mode") {
        return { section: "transport", question: "duration", index: idx, returnToReview: true };
      }
      return { section: "review", question: "title" };
    }
  }

  switch (norm.section) {
    case "basic": {
      if (norm.question === "title") return { section: "basic", question: "proposal-reason" };
      if (norm.question === "proposal-reason") return { section: "basic", question: "headcount" };
      if (norm.question === "headcount") return { section: "route", question: "city", index: 0 };
      break;
    }

    case "route": {
      const idx = norm.index ?? 0;
      if (norm.question === "city") return { section: "route", question: "arrival-date", index: idx };
      if (norm.question === "arrival-date") return { section: "route", question: "departure-date", index: idx };
      if (norm.question === "departure-date") return { section: "route", question: "add-city", index: idx };
      if (norm.question === "add-city") {
        if (idx + 1 < formData.routes.length) {
          return { section: "route", question: "city", index: idx + 1 };
        }
        return { section: "accommodation", question: "status", index: 0 };
      }
      break;
    }

    case "accommodation": {
      const idx = norm.index ?? 0;
      const totalRoutes = formData.routes.length;
      const isLastStay = idx >= totalRoutes - 1;

      if (norm.question === "status") {
        const stay = formData.accommodations[idx];
        const isSearching = stay ? stay.isSearching === true : true;
        if (isSearching) {
          return isLastStay
            ? { section: "transport", question: "endpoints", index: 0 }
            : { section: "accommodation", question: "status", index: idx + 1 };
        }
        return { section: "accommodation", question: "hotel-name", index: idx };
      }

      if (norm.question === "hotel-name") {
        return isLastStay
          ? { section: "transport", question: "endpoints", index: 0 }
          : { section: "accommodation", question: "status", index: idx + 1 };
      }
      break;
    }

    case "transport": {
      const idx = norm.index ?? 0;
      const totalLegs = formData.routes.length + 1;
      const isLastLeg = idx >= totalLegs - 1;

      if (norm.question === "endpoints") {
        return { section: "transport", question: "status", index: idx };
      }

      if (norm.question === "status") {
        const tr = formData.transports[idx];
        const isNotChecked = tr ? tr.bookingStatus === "NOT_CHECKED" : true;
        if (isNotChecked) {
          return isLastLeg
            ? { section: "review", question: "title" }
            : { section: "transport", question: "endpoints", index: idx + 1 };
        }
        return { section: "transport", question: "mode", index: idx };
      }

      if (norm.question === "mode") {
        return { section: "transport", question: "duration", index: idx };
      }

      if (norm.question === "duration") {
        return isLastLeg
          ? { section: "review", question: "title" }
          : { section: "transport", question: "endpoints", index: idx + 1 };
      }
      break;
    }

    case "review": {
      return { section: "review", question: "title" };
    }
  }

  return { section: "review", question: "title" };
}

export function getPreviousWizardCursor(
  currentCursor: FirstPlanWizardCursor,
  formData: PlanEditorFormData
): FirstPlanWizardCursor {
  const norm = normalizeWizardCursor(currentCursor, formData);

  if (norm.returnToReview) {
    return { section: "review", question: "title" };
  }

  switch (norm.section) {
    case "basic": {
      if (norm.question === "headcount") return { section: "basic", question: "proposal-reason" };
      if (norm.question === "proposal-reason") return { section: "basic", question: "title" };
      return { section: "basic", question: "title" };
    }

    case "route": {
      const idx = norm.index ?? 0;
      if (norm.question === "add-city") return { section: "route", question: "departure-date", index: idx };
      if (norm.question === "departure-date") return { section: "route", question: "arrival-date", index: idx };
      if (norm.question === "arrival-date") return { section: "route", question: "city", index: idx };
      if (norm.question === "city") {
        if (idx > 0) return { section: "route", question: "add-city", index: idx - 1 };
        return { section: "basic", question: "headcount" };
      }
      break;
    }

    case "accommodation": {
      const idx = norm.index ?? 0;
      if (norm.question === "hotel-name") {
        return { section: "accommodation", question: "status", index: idx };
      }
      if (norm.question === "status") {
        if (idx > 0) {
          const prevStay = formData.accommodations[idx - 1];
          const isSearching = prevStay ? prevStay.isSearching === true : true;
          if (isSearching) {
            return { section: "accommodation", question: "status", index: idx - 1 };
          }
          return { section: "accommodation", question: "hotel-name", index: idx - 1 };
        }
        const lastRouteIndex = Math.max(0, formData.routes.length - 1);
        return { section: "route", question: "add-city", index: lastRouteIndex };
      }
      break;
    }

    case "transport": {
      const idx = norm.index ?? 0;
      if (norm.question === "duration") return { section: "transport", question: "mode", index: idx };
      if (norm.question === "mode") return { section: "transport", question: "status", index: idx };
      if (norm.question === "status") return { section: "transport", question: "endpoints", index: idx };
      if (norm.question === "endpoints") {
        if (idx > 0) {
          const prevLeg = formData.transports[idx - 1];
          const isNotChecked = prevLeg ? prevLeg.bookingStatus === "NOT_CHECKED" : true;
          if (isNotChecked) {
            return { section: "transport", question: "status", index: idx - 1 };
          }
          return { section: "transport", question: "duration", index: idx - 1 };
        }
        const lastStayIndex = Math.max(0, formData.routes.length - 1);
        const lastStay = formData.accommodations[lastStayIndex];
        const isSearching = lastStay ? lastStay.isSearching === true : true;
        if (isSearching) {
          return { section: "accommodation", question: "status", index: lastStayIndex };
        }
        return { section: "accommodation", question: "hotel-name", index: lastStayIndex };
      }
      break;
    }

    case "review": {
      const lastLegIndex = formData.routes.length;
      const lastLeg = formData.transports[lastLegIndex];
      const isNotChecked = lastLeg ? lastLeg.bookingStatus === "NOT_CHECKED" : true;
      if (isNotChecked) {
        return { section: "transport", question: "status", index: lastLegIndex };
      }
      return { section: "transport", question: "duration", index: lastLegIndex };
    }
  }

  return { section: "basic", question: "title" };
}

export function mapValidationErrorToCursor(
  validationError: string,
  formData: PlanEditorFormData
): FirstPlanWizardCursor {
  if (validationError.includes("제목을 입력해주세요")) {
    return { section: "basic", question: "title" };
  }
  if (validationError.includes("기준 인원수는 1명 이상")) {
    return { section: "basic", question: "headcount" };
  }

  if (validationError.includes("최소 1개 이상의 방문 도시")) {
    return { section: "route", question: "city", index: 0 };
  }

  if (validationError.includes("도착일과 출발일을 입력해주세요")) {
    const incompleteIdx = formData.routes.findIndex(
      (r) => !r.city.trim() || !r.arrivalDate || !r.departureDate
    );
    const idx = incompleteIdx !== -1 ? incompleteIdx : 0;
    const route = formData.routes[idx];
    if (!route?.city.trim()) return { section: "route", question: "city", index: idx };
    if (!route?.arrivalDate) return { section: "route", question: "arrival-date", index: idx };
    return { section: "route", question: "departure-date", index: idx };
  }

  if (validationError.includes("출발일은 도착일 이후여야 합니다")) {
    const invalidIdx = formData.routes.findIndex((r) => r.arrivalDate >= r.departureDate);
    return { section: "route", question: "departure-date", index: invalidIdx !== -1 ? invalidIdx : 0 };
  }

  if (validationError.includes("도시 체류 일정은 서로 겹칠 수 없습니다")) {
    for (let i = 1; i < formData.routes.length; i += 1) {
      if (formData.routes[i - 1]!.departureDate > formData.routes[i]!.arrivalDate) {
        return { section: "route", question: "arrival-date", index: i };
      }
    }
    return { section: "route", question: "arrival-date", index: 1 };
  }

  if (validationError.includes("각 방문 도시의 숙소 또는 숙소 찾는 중")) {
    const invalidStayIdx = formData.accommodations.findIndex(
      (stay) =>
        !stay.city.trim() ||
        !stay.period.trim() ||
        stay.nights < 1 ||
        (stay.isSearching ? Boolean(stay.hotelName.trim()) : !stay.hotelName.trim())
    );
    const idx = invalidStayIdx !== -1 ? invalidStayIdx : Math.min(formData.accommodations.length, Math.max(0, formData.routes.length - 1));
    const stay = formData.accommodations[idx];
    if (stay && !stay.isSearching && !stay.hotelName.trim()) {
      return { section: "accommodation", question: "hotel-name", index: idx };
    }
    return { section: "accommodation", question: "status", index: idx };
  }

  if (validationError.includes("교통을") && validationError.includes("개 추가해주세요")) {
    return { section: "transport", question: "endpoints", index: Math.min(formData.transports.length, formData.routes.length) };
  }

  if (validationError.includes("교통 구간의 출발지·도착지와 확인 상태")) {
    const incompleteTrIdx = formData.transports.findIndex(
      (tr) =>
        !tr.fromCity.trim() ||
        !tr.toCity.trim() ||
        (tr.bookingStatus !== "NOT_CHECKED" && (!tr.mode.trim() || !tr.durationText.trim()))
    );
    const idx = incompleteTrIdx !== -1 ? incompleteTrIdx : 0;
    const tr = formData.transports[idx];
    if (!tr?.fromCity.trim() || !tr?.toCity.trim()) {
      return { section: "transport", question: "endpoints", index: idx };
    }
    if (tr.bookingStatus !== "NOT_CHECKED" && !tr.mode.trim()) {
      return { section: "transport", question: "mode", index: idx };
    }
    if (tr.bookingStatus !== "NOT_CHECKED" && !tr.durationText.trim()) {
      return { section: "transport", question: "duration", index: idx };
    }
    return { section: "transport", question: "endpoints", index: idx };
  }

  return { section: "basic", question: "title" };
}
