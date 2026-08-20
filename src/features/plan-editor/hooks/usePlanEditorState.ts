import { useState, useEffect, useMemo, useCallback } from "react";
import { getRouteValidationError, getStayNightCount, type AccommodationSnapshot, type CityStay, type TransportSnapshot, type TripPlan, type TripRoom } from "../../../core/domain/room.ts";
import { calculatePlanCost } from "../../../core/calculations/plan-cost.ts";
import { calculatePlanDifference } from "../../../core/calculations/plan-diff.ts";

export interface PlanEditorFormData {
  readonly title: string;
  readonly proposalReason: string;
  readonly baseHeadcount: number;
  readonly routes: ReadonlyArray<CityStay>;
  readonly accommodations: ReadonlyArray<AccommodationSnapshot>;
  readonly transports: ReadonlyArray<TransportSnapshot>;
  readonly clonedFromPlanId?: string;
}

export const syncAccommodationNights = (
  routes: ReadonlyArray<CityStay>,
  accommodations: ReadonlyArray<AccommodationSnapshot>
): ReadonlyArray<AccommodationSnapshot> =>
  accommodations.map((accommodation, index) => {
    const indexedRoute = routes[index];
    const route = indexedRoute?.city === accommodation.city
      ? indexedRoute
      : routes.find((stay) => stay.city === accommodation.city) ?? indexedRoute;
    return route
      ? { ...accommodation, nights: Math.max(0, getStayNightCount(route)) }
      : accommodation;
  });

interface StoredPlanEditorDraft extends PlanEditorFormData {
  readonly ownerId: string;
  readonly basePlanFingerprint?: string;
  readonly updatedAt: string;
}

export function getPlanEditorDraftKey(
  userId: string,
  roomId: string,
  draftTarget: string
): string {
  return `galanda_draft_${userId}_${roomId}_${draftTarget}`;
}

export function getPlanFingerprint(
  plan: Pick<TripPlan, "title" | "proposalReason" | "baseHeadcount" | "routes" | "accommodations" | "transports"> | undefined
): string | undefined {
  if (!plan) return undefined;
  return JSON.stringify({
    title: plan.title,
    proposalReason: plan.proposalReason,
    baseHeadcount: plan.baseHeadcount,
    routes: plan.routes,
    accommodations: plan.accommodations,
    transports: plan.transports,
  });
}

export function hasDraftBaseChanged(
  storedFingerprint: string | undefined,
  currentFingerprint: string | undefined
): boolean {
  return storedFingerprint !== currentFingerprint;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasPriceRange(value: unknown): boolean {
  return value === undefined || (
    isRecord(value) && Number.isFinite(value.min) && Number.isFinite(value.max)
  );
}

function hasBookingStatus(value: unknown): boolean {
  return ["AVAILABLE", "NEED_CHECK", "FULL", "NOT_CHECKED"].includes(String(value));
}

function isAccommodation(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.city === "string" &&
    typeof value.period === "string" &&
    Number.isFinite(value.nights) &&
    typeof value.hotelName === "string" &&
    (value.isSearching === undefined || typeof value.isSearching === "boolean") &&
    hasBookingStatus(value.bookingStatus) &&
    hasPriceRange(value.priceRange);
}

function isTransport(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.fromCity === "string" &&
    typeof value.toCity === "string" &&
    typeof value.mode === "string" &&
    typeof value.hasTransfer === "boolean" &&
    typeof value.durationText === "string" &&
    hasBookingStatus(value.bookingStatus) &&
    hasPriceRange(value.priceRange);
}

export function parsePlanEditorDraft(raw: string | null): StoredPlanEditorDraft | undefined {
  if (!raw) return undefined;

  try {
    const draft: unknown = JSON.parse(raw);
    if (
      !isRecord(draft) ||
      typeof draft.ownerId !== "string" ||
      typeof draft.title !== "string" ||
      typeof draft.proposalReason !== "string" ||
      !Number.isFinite(draft.baseHeadcount) ||
      Number(draft.baseHeadcount) < 1 ||
      !Array.isArray(draft.routes) ||
      !draft.routes.every((route) =>
        isRecord(route) &&
        typeof route.city === "string" &&
        typeof route.arrivalDate === "string" &&
        typeof route.departureDate === "string"
      ) ||
      !Array.isArray(draft.accommodations) ||
      !draft.accommodations.every(isAccommodation) ||
      !Array.isArray(draft.transports) ||
      !draft.transports.every(isTransport) ||
      typeof draft.updatedAt !== "string" ||
      (draft.basePlanFingerprint !== undefined && typeof draft.basePlanFingerprint !== "string") ||
      (draft.clonedFromPlanId !== undefined && typeof draft.clonedFromPlanId !== "string")
    ) {
      return undefined;
    }

    return draft as unknown as StoredPlanEditorDraft;
  } catch {
    return undefined;
  }
}

export function usePlanEditorState(
  room: TripRoom | undefined,
  initialPlan?: TripPlan,
  cloneFromPlan?: TripPlan,
  userId?: string
) {
  const defaultRoutes: ReadonlyArray<CityStay> = useMemo(() => {
    if (cloneFromPlan?.routes && cloneFromPlan.routes.length > 0) {
      return cloneFromPlan.routes;
    }
    if (initialPlan?.routes && initialPlan.routes.length > 0) {
      return initialPlan.routes;
    }
    const dest = room?.destination || "제주도";
    return [{ city: dest, arrivalDate: "", departureDate: "" }];
  }, [cloneFromPlan, initialPlan, room]);

  const defaultAccommodations: ReadonlyArray<AccommodationSnapshot> = useMemo(() => {
    if (cloneFromPlan?.accommodations && cloneFromPlan.accommodations.length > 0) {
      return cloneFromPlan.accommodations;
    }
    if (initialPlan?.accommodations && initialPlan.accommodations.length > 0) {
      return initialPlan.accommodations;
    }
    return [
      {
        id: `stay-temp-1`,
        city: defaultRoutes[0]?.city ?? (room?.destination || "제주도"),
        period: "전체 일정",
        nights: defaultRoutes[0] ? Math.max(0, getStayNightCount(defaultRoutes[0])) : 0,
        hotelName: "숙소 찾는 중",
        isSearching: true,
        bookingStatus: "NEED_CHECK",
        priceRange: { min: 0, max: 0 },
      },
    ];
  }, [cloneFromPlan, initialPlan, defaultRoutes, room]);

  const defaultTransports: ReadonlyArray<TransportSnapshot> = useMemo(() => {
    if (cloneFromPlan?.transports && cloneFromPlan.transports.length > 0) {
      return cloneFromPlan.transports;
    }
    if (initialPlan?.transports && initialPlan.transports.length > 0) {
      return initialPlan.transports;
    }
    return [
      {
        id: `trans-temp-1`,
        fromCity: "출발지",
        toCity: room?.destination || "도착지",
        mode: "항공 / KTX",
        hasTransfer: false,
        durationText: "약 1시간",
        bookingStatus: "AVAILABLE",
        priceRange: { min: 0, max: 0 },
      },
    ];
  }, [cloneFromPlan, initialPlan, room]);

  const [title, setTitle] = useState(
    initialPlan?.title ||
      (cloneFromPlan ? `${cloneFromPlan.title} 대안` : "")
  );
  const [proposalReason, setProposalReason] = useState(
    initialPlan?.proposalReason || cloneFromPlan?.proposalReason || ""
  );
  const [baseHeadcount, setBaseHeadcount] = useState(
    initialPlan?.baseHeadcount || cloneFromPlan?.baseHeadcount || (room?.members.length || 4)
  );
  const [routes, setRoutes] = useState<ReadonlyArray<CityStay>>(defaultRoutes);
  const [accommodations, setAccommodations] = useState<ReadonlyArray<AccommodationSnapshot>>(defaultAccommodations);
  const [transports, setTransports] = useState<ReadonlyArray<TransportSnapshot>>(defaultTransports);
  const [lastSavedTime, setLastSavedTime] = useState<Date>(new Date());
  const [hydratedEditorId, setHydratedEditorId] = useState<string>();
  const [draftConflict, setDraftConflict] = useState<StoredPlanEditorDraft>();

  const draftTarget = initialPlan?.id ?? (cloneFromPlan ? `clone_${cloneFromPlan.id}` : "new");
  const draftKey = room && userId
    ? getPlanEditorDraftKey(userId, room.id, draftTarget)
    : undefined;
  const editorId = draftKey;
  const basePlanFingerprint = getPlanFingerprint(initialPlan ?? cloneFromPlan);

  const resetToInitialData = useCallback(() => {
    setTitle(initialPlan?.title || (cloneFromPlan ? `${cloneFromPlan.title} 대안` : ""));
    setProposalReason(initialPlan?.proposalReason || cloneFromPlan?.proposalReason || "");
    setBaseHeadcount(
      initialPlan?.baseHeadcount || cloneFromPlan?.baseHeadcount || (room?.members.length || 4)
    );
    setRoutes(defaultRoutes);
    setAccommodations(defaultAccommodations);
    setTransports(defaultTransports);
    setLastSavedTime(new Date());
  }, [initialPlan, cloneFromPlan, room, defaultRoutes, defaultAccommodations, defaultTransports]);

  useEffect(() => {
    if (!draftKey || !editorId || hydratedEditorId === editorId) return;

    setDraftConflict(undefined);
    let draft: StoredPlanEditorDraft | undefined;
    try {
      draft = parsePlanEditorDraft(localStorage.getItem(draftKey));
    } catch {
      // 저장소 접근이 차단된 경우 공개본/초기값으로 계속 편집해요.
    }
    if (
      draft &&
      draft.ownerId === userId &&
      draft.clonedFromPlanId === cloneFromPlan?.id &&
      hasDraftBaseChanged(draft.basePlanFingerprint, basePlanFingerprint)
    ) {
      resetToInitialData();
      setDraftConflict(draft);
    } else if (draft && draft.ownerId === userId && draft.clonedFromPlanId === cloneFromPlan?.id) {
      setTitle(draft.title);
      setProposalReason(draft.proposalReason);
      setBaseHeadcount(draft.baseHeadcount);
      setRoutes(draft.routes);
      setAccommodations(draft.accommodations);
      setTransports(draft.transports);
      setLastSavedTime(new Date(draft.updatedAt));
    } else {
      resetToInitialData();
    }
    setHydratedEditorId(editorId);
  }, [draftKey, editorId, hydratedEditorId, cloneFromPlan, userId, basePlanFingerprint, resetToInitialData]);

  useEffect(() => {
    setAccommodations((current) => syncAccommodationNights(routes, current));
  }, [routes]);

  // 도시 박수 합계 계산
  const currentTotalNights = useMemo(() => {
    return routes.reduce((sum, r) => sum + Math.max(0, getStayNightCount(r)), 0);
  }, [routes]);

  // 비용 계산
  const costSummary = useMemo(() => {
    return calculatePlanCost(accommodations, transports, baseHeadcount);
  }, [accommodations, transports, baseHeadcount]);

  // 복제 원본과의 차이점 계산
  const diffFromOriginal = useMemo(() => {
    if (!cloneFromPlan) return undefined;
    return calculatePlanDifference(cloneFromPlan, {
      title,
      routes,
      accommodations,
      transports,
      baseHeadcount,
    });
  }, [cloneFromPlan, title, routes, accommodations, transports, baseHeadcount]);

  // 유효성 검사
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (!title.trim()) {
      errors.push("여행안 제목을 입력해주세요.");
    }
    if (routes.length === 0) {
      errors.push("최소 1개 이상의 방문 도시를 추가해주세요.");
    }
    for (const r of routes) {
      if (!r.city.trim()) {
        errors.push("도시 이름을 모두 입력해주세요.");
        break;
      }
      if (!r.arrivalDate || !r.departureDate) errors.push(`${r.city || "도시"}의 도착일과 출발일을 입력해주세요.`);
    }
    const routeError = getRouteValidationError(routes);
    if (routeError) errors.push(routeError);

    return {
      isValid: errors.length === 0,
      firstError: errors[0],
      errorCount: errors.length,
      errors,
    };
  }, [title, routes]);

  // 도시 관리 핸들러
  const handleAddCity = useCallback((city: string = "") => {
    setRoutes((prev) => [...prev, { city, arrivalDate: "", departureDate: "" }]);
    setLastSavedTime(new Date());
  }, []);

  const handleUpdateCity = useCallback((index: number, updated: Partial<CityStay>) => {
    setRoutes((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...updated };
      }
      return next;
    });
    setLastSavedTime(new Date());
  }, []);

  const handleRemoveCity = useCallback((index: number) => {
    setRoutes((prev) => prev.filter((_, i) => i !== index));
    setLastSavedTime(new Date());
  }, []);

  // 숙소 관리 핸들러
  const handleAddAccommodation = useCallback((acc: AccommodationSnapshot) => {
    setAccommodations((prev) => [...prev, acc]);
    setLastSavedTime(new Date());
  }, []);

  const handleUpdateAccommodation = useCallback((id: string, updated: Partial<AccommodationSnapshot>) => {
    setAccommodations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
    setLastSavedTime(new Date());
  }, []);

  const handleRemoveAccommodation = useCallback((id: string) => {
    setAccommodations((prev) => prev.filter((item) => item.id !== id));
    setLastSavedTime(new Date());
  }, []);

  // 교통 관리 핸들러
  const handleAddTransport = useCallback((trans: TransportSnapshot) => {
    setTransports((prev) => [...prev, trans]);
    setLastSavedTime(new Date());
  }, []);

  const handleUpdateTransport = useCallback((id: string, updated: Partial<TransportSnapshot>) => {
    setTransports((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
    setLastSavedTime(new Date());
  }, []);

  const handleRemoveTransport = useCallback((id: string) => {
    setTransports((prev) => prev.filter((item) => item.id !== id));
    setLastSavedTime(new Date());
  }, []);

  // 자동 임시 저장 (로컬스토리지 Draft)
  useEffect(() => {
    if (!draftKey || !userId || hydratedEditorId !== editorId || draftConflict) return;
    const draftData = {
      ownerId: userId,
      basePlanFingerprint,
      title,
      proposalReason,
      baseHeadcount,
      routes,
      accommodations,
      transports,
      clonedFromPlanId: cloneFromPlan?.id,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {
      // ignore
    }
  }, [draftKey, editorId, hydratedEditorId, draftConflict, userId, basePlanFingerprint, cloneFromPlan, title, proposalReason, baseHeadcount, routes, accommodations, transports]);

  const discardDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    discardDraft();
    resetToInitialData();
  }, [discardDraft, resetToInitialData]);

  const restoreConflictingDraft = useCallback(() => {
    if (!draftConflict) return;
    setTitle(draftConflict.title);
    setProposalReason(draftConflict.proposalReason);
    setBaseHeadcount(draftConflict.baseHeadcount);
    setRoutes(draftConflict.routes);
    setAccommodations(draftConflict.accommodations);
    setTransports(draftConflict.transports);
    setLastSavedTime(new Date(draftConflict.updatedAt));
    setDraftConflict(undefined);
  }, [draftConflict]);

  const useLatestPublishedPlan = useCallback(() => {
    discardDraft();
    resetToInitialData();
    setDraftConflict(undefined);
  }, [discardDraft, resetToInitialData]);

  return {
    title,
    setTitle: (val: string) => { setTitle(val); setLastSavedTime(new Date()); },
    proposalReason,
    setProposalReason: (val: string) => { setProposalReason(val); setLastSavedTime(new Date()); },
    baseHeadcount,
    setBaseHeadcount: (val: number) => { setBaseHeadcount(val); setLastSavedTime(new Date()); },
    routes,
    setRoutes,
    totalTripNights: currentTotalNights,
    currentTotalNights,
    handleAddCity,
    handleUpdateCity,
    handleRemoveCity,
    accommodations,
    handleAddAccommodation,
    handleUpdateAccommodation,
    handleRemoveAccommodation,
    transports,
    handleAddTransport,
    handleUpdateTransport,
    handleRemoveTransport,
    costSummary,
    diffFromOriginal,
    validation,
    lastSavedTime,
    clearDraft,
    discardDraft,
    draftConflict: Boolean(draftConflict),
    restoreConflictingDraft,
    useLatestPublishedPlan,
  };
}
