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

export function usePlanEditorState(
  room: TripRoom | undefined,
  initialPlan?: TripPlan,
  cloneFromPlan?: TripPlan
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
    if (!room) return;
    const draftKey = `galanda_draft_${room.id}_${initialPlan?.id || "new"}`;
    const draftData = {
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
  }, [room, initialPlan, cloneFromPlan, title, proposalReason, baseHeadcount, routes, accommodations, transports]);

  const clearDraft = useCallback(() => {
    if (!room) return;
    const draftKey = `galanda_draft_${room.id}_${initialPlan?.id || "new"}`;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [room, initialPlan]);

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
  };
}
