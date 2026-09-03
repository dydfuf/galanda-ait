import { useState, useEffect, useMemo, useCallback } from "react";
import { getPlanPublishValidationErrors, getStayNightCount, type AccommodationSnapshot, type CityStay, type TransportSnapshot, type TripPlan, type TripRoom } from "../../../core/domain/room.ts";
import { calculatePlanCost } from "../../../core/calculations/plan-cost.ts";
import { calculatePlanDifference } from "../../../core/calculations/plan-diff.ts";
import {
  isFirstPlanWizardQuestion,
  isFirstPlanWizardSection,
  type FirstPlanWizardCursor,
} from "../first-plan-wizard-flow.ts";

export interface PlanEditorFormData {
  readonly title: string;
  readonly proposalReason: string;
  readonly baseHeadcount: number;
  readonly routes: ReadonlyArray<CityStay>;
  readonly accommodations: ReadonlyArray<AccommodationSnapshot>;
  readonly transports: ReadonlyArray<TransportSnapshot>;
  readonly clonedFromPlanId?: string;
}

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rebaseValue = <T,>(base: T, local: T, latest: T): T => {
  if (sameValue(local, base)) return structuredClone(latest);
  if (sameValue(latest, base)) return structuredClone(local);
  if (
    Array.isArray(base) &&
    Array.isArray(local) &&
    Array.isArray(latest) &&
    base.length === local.length &&
    base.length === latest.length
  ) {
    return base.map((value, index) =>
      rebaseValue(value, local[index], latest[index])
    ) as T;
  }
  if (isPlainRecord(base) && isPlainRecord(local) && isPlainRecord(latest)) {
    return Object.fromEntries(
      Object.keys({ ...base, ...local, ...latest }).map((key) => [
        key,
        rebaseValue(base[key], local[key], latest[key]),
      ])
    ) as T;
  }
  return structuredClone(local);
};

export const rebasePlanEditorData = (
  base: PlanEditorFormData,
  local: PlanEditorFormData,
  latest: PlanEditorFormData
): PlanEditorFormData => rebaseValue(base, local, latest);

export type DraftSaveStatus = "IDLE" | "SAVING" | "SAVED" | "ERROR";

export const getDraftSaveStatusLabel = (status: DraftSaveStatus): string => ({
  IDLE: "아직 저장되지 않음",
  SAVING: "자동 저장 중…",
  SAVED: "자동 저장됨",
  ERROR: "임시 저장하지 못했어요",
})[status];

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
      ? {
          ...accommodation,
          city: route.city,
          period: `${route.arrivalDate} ~ ${route.departureDate}`,
          nights: Math.max(0, getStayNightCount(route)),
        }
      : accommodation;
  });

export interface StoredPlanEditorDraft extends PlanEditorFormData {
  readonly ownerId: string;
  readonly basePlanFingerprint?: string;
  readonly updatedAt: string;
  readonly wizardCursor?: FirstPlanWizardCursor;
}

export function getPlanEditorInitialData(
  room: TripRoom | undefined,
  initialPlan?: TripPlan,
  cloneFromPlan?: TripPlan
): PlanEditorFormData {
  const source = initialPlan ?? cloneFromPlan;

  return {
    title: initialPlan?.title ?? (cloneFromPlan ? `${cloneFromPlan.title} 대안` : ""),
    proposalReason: source?.proposalReason ?? "",
    baseHeadcount: source?.baseHeadcount ?? Math.max(1, room?.members.length ?? 1),
    routes: structuredClone(source?.routes ?? []),
    accommodations: structuredClone(source?.accommodations ?? []).map((stay) =>
      stay.isSearching ? { ...stay, hotelName: "" } : stay
    ),
    transports: structuredClone(source?.transports ?? []),
    ...(cloneFromPlan ? { clonedFromPlanId: cloneFromPlan.id } : {}),
  };
}

export function savePlanEditorDraft(
  storage: Pick<Storage, "setItem">,
  key: string,
  draft: StoredPlanEditorDraft
): Extract<DraftSaveStatus, "SAVED" | "ERROR"> {
  try {
    storage.setItem(key, JSON.stringify(draft));
    return "SAVED";
  } catch {
    return "ERROR";
  }
}

export function getPlanEditorDraftKey(
  userId: string,
  roomId: string,
  draftTarget: string
): string {
  return `galanda_draft_${userId}_${roomId}_${draftTarget}`;
}

export function getPlanFingerprint(
  plan: Pick<TripPlan, "revision" | "title" | "proposalReason" | "baseHeadcount" | "routes" | "accommodations" | "transports"> | undefined
): string | undefined {
  if (!plan) return undefined;
  return JSON.stringify({
    revision: plan.revision,
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

function isWizardCursor(value: unknown): value is FirstPlanWizardCursor {
  return (
    isRecord(value) &&
    isFirstPlanWizardSection(value.section) &&
    isFirstPlanWizardQuestion(value.question) &&
    (value.index === undefined || (Number.isInteger(value.index) && Number(value.index) >= 0)) &&
    (value.returnToReview === undefined || typeof value.returnToReview === "boolean")
  );
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
      (draft.clonedFromPlanId !== undefined && typeof draft.clonedFromPlanId !== "string") ||
      (draft.wizardCursor !== undefined && !isWizardCursor(draft.wizardCursor))
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
  userId?: string,
  pauseDraftSave = false,
  wizardCursor?: FirstPlanWizardCursor
) {
  const initialData = useMemo(
    () => getPlanEditorInitialData(room, initialPlan, cloneFromPlan),
    [room, initialPlan, cloneFromPlan]
  );
  const [title, setTitle] = useState(initialData.title);
  const [proposalReason, setProposalReason] = useState(initialData.proposalReason);
  const [baseHeadcount, setBaseHeadcount] = useState(initialData.baseHeadcount);
  const [routes, setRoutes] = useState<ReadonlyArray<CityStay>>(initialData.routes);
  const [accommodations, setAccommodations] = useState<ReadonlyArray<AccommodationSnapshot>>(initialData.accommodations);
  const [transports, setTransports] = useState<ReadonlyArray<TransportSnapshot>>(initialData.transports);
  const [savedWizardCursor, setSavedWizardCursor] = useState<FirstPlanWizardCursor | undefined>();
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>("IDLE");
  const [hydratedEditorId, setHydratedEditorId] = useState<string>();
  const [draftConflict, setDraftConflict] = useState<StoredPlanEditorDraft>();

  const draftTarget = initialPlan?.id ?? (cloneFromPlan ? `clone_${cloneFromPlan.id}` : "new");
  const draftKey = room && userId
    ? getPlanEditorDraftKey(userId, room.id, draftTarget)
    : undefined;
  const editorId = draftKey;
  const basePlanFingerprint = getPlanFingerprint(initialPlan ?? cloneFromPlan);

  const resetToInitialData = useCallback(() => {
    setTitle(initialData.title);
    setProposalReason(initialData.proposalReason);
    setBaseHeadcount(initialData.baseHeadcount);
    setRoutes(initialData.routes);
    setAccommodations(initialData.accommodations);
    setTransports(initialData.transports);
    setSavedWizardCursor(undefined);
    setDraftSaveStatus("IDLE");
  }, [initialData]);

  const markDraftSaving = useCallback(() => {
    setDraftSaveStatus("SAVING");
  }, []);

  useEffect(() => {
    if (!draftKey || !editorId || hydratedEditorId === editorId) return;

    setDraftConflict(undefined);
    let draft: StoredPlanEditorDraft | undefined;
    try {
      draft = parsePlanEditorDraft(localStorage.getItem(draftKey));
    } catch {
      // 저장소 접근이 차단된 경우 공개본/초기값으로 계속 편집해요.
      setDraftSaveStatus("ERROR");
    }
    if (
      draft &&
      draft.ownerId === userId &&
      draft.clonedFromPlanId === cloneFromPlan?.id &&
      hasDraftBaseChanged(draft.basePlanFingerprint, basePlanFingerprint)
    ) {
      resetToInitialData();
      setSavedWizardCursor(draft.wizardCursor);
      setDraftConflict(draft);
    } else if (draft && draft.ownerId === userId && draft.clonedFromPlanId === cloneFromPlan?.id) {
      setTitle(draft.title);
      setProposalReason(draft.proposalReason);
      setBaseHeadcount(draft.baseHeadcount);
      setRoutes(draft.routes);
      setAccommodations(draft.accommodations);
      setTransports(draft.transports);
      setSavedWizardCursor(draft.wizardCursor);
      setDraftSaveStatus("SAVED");
    } else {
      resetToInitialData();
      setSavedWizardCursor(undefined);
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
    const errors = getPlanPublishValidationErrors({
      title,
      baseHeadcount,
      routes,
      accommodations,
      transports,
    });

    return {
      isValid: errors.length === 0,
      firstError: errors[0],
      errorCount: errors.length,
      errors,
    };
  }, [title, baseHeadcount, routes, accommodations, transports]);

  // 도시 관리 핸들러
  const handleAddCity = useCallback((city: string = "") => {
    setRoutes((prev) => [...prev, { city, arrivalDate: "", departureDate: "" }]);
    markDraftSaving();
  }, [markDraftSaving]);

  const handleUpdateCity = useCallback((index: number, updated: Partial<CityStay>) => {
    setRoutes((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...updated };
      } else {
        while (next.length < index) {
          next.push({ city: "", arrivalDate: "", departureDate: "" });
        }
        next[index] = { city: "", arrivalDate: "", departureDate: "", ...updated };
      }
      return next;
    });
    markDraftSaving();
  }, [markDraftSaving]);

  const handleRemoveCity = useCallback((index: number) => {
    setRoutes((prev) => prev.filter((_, i) => i !== index));
    markDraftSaving();
  }, [markDraftSaving]);

  // 숙소 관리 핸들러
  const handleAddAccommodation = useCallback((acc: AccommodationSnapshot) => {
    setAccommodations((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === acc.id);
      if (existingIndex !== -1) {
        return prev.map((item, idx) => (idx === existingIndex ? { ...item, ...acc } : item));
      }
      return [...prev, acc];
    });
    markDraftSaving();
  }, [markDraftSaving]);

  const handleUpdateAccommodation = useCallback((id: string, updated: Partial<AccommodationSnapshot>) => {
    setAccommodations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
    markDraftSaving();
  }, [markDraftSaving]);

  const handleRemoveAccommodation = useCallback((id: string) => {
    setAccommodations((prev) => prev.filter((item) => item.id !== id));
    markDraftSaving();
  }, [markDraftSaving]);

  // 교통 관리 핸들러
  const handleAddTransport = useCallback((trans: TransportSnapshot) => {
    setTransports((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === trans.id);
      if (existingIndex !== -1) {
        return prev.map((item, idx) => (idx === existingIndex ? { ...item, ...trans } : item));
      }
      return [...prev, trans];
    });
    markDraftSaving();
  }, [markDraftSaving]);

  const handleUpdateTransport = useCallback((id: string, updated: Partial<TransportSnapshot>) => {
    setTransports((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
    markDraftSaving();
  }, [markDraftSaving]);

  const handleRemoveTransport = useCallback((id: string) => {
    setTransports((prev) => prev.filter((item) => item.id !== id));
    markDraftSaving();
  }, [markDraftSaving]);

  // 자동 임시 저장 (로컬스토리지 Draft)
  useEffect(() => {
    if (!draftKey || !userId || hydratedEditorId !== editorId || draftConflict || pauseDraftSave) return;
    setDraftSaveStatus("SAVING");
    const updatedAt = new Date().toISOString();
    const draftData: StoredPlanEditorDraft = {
      ownerId: userId,
      basePlanFingerprint,
      title,
      proposalReason,
      baseHeadcount,
      routes,
      accommodations,
      transports,
      clonedFromPlanId: cloneFromPlan?.id,
      updatedAt,
      ...(wizardCursor ? { wizardCursor } : {}),
    };
    const status = savePlanEditorDraft(localStorage, draftKey, draftData);
    setDraftSaveStatus(status);
  }, [
    draftKey,
    editorId,
    hydratedEditorId,
    draftConflict,
    pauseDraftSave,
    userId,
    basePlanFingerprint,
    cloneFromPlan,
    title,
    proposalReason,
    baseHeadcount,
    routes,
    accommodations,
    transports,
    wizardCursor,
  ]);

  const discardDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    setSavedWizardCursor(undefined);
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
    if (draftConflict.wizardCursor) {
      setSavedWizardCursor(draftConflict.wizardCursor);
    }
    markDraftSaving();
    setDraftConflict(undefined);
  }, [draftConflict, markDraftSaving]);

  const useLatestPublishedPlan = useCallback(() => {
    discardDraft();
    resetToInitialData();
    setDraftConflict(undefined);
  }, [discardDraft, resetToInitialData]);

  const replaceFormData = useCallback((data: PlanEditorFormData, cursor?: FirstPlanWizardCursor) => {
    setTitle(data.title);
    setProposalReason(data.proposalReason);
    setBaseHeadcount(data.baseHeadcount);
    setRoutes(data.routes);
    setAccommodations(data.accommodations);
    setTransports(data.transports);
    if (cursor) {
      setSavedWizardCursor(cursor);
    }
    markDraftSaving();
  }, [markDraftSaving]);

  return {
    title,
    setTitle: (val: string) => { setTitle(val); markDraftSaving(); },
    proposalReason,
    setProposalReason: (val: string) => { setProposalReason(val); markDraftSaving(); },
    baseHeadcount,
    setBaseHeadcount: (val: number) => { setBaseHeadcount(val); markDraftSaving(); },
    routes,
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
    draftSaveStatus,
    isDraftHydrated: !editorId || hydratedEditorId === editorId,
    savedWizardCursor,
    clearDraft,
    discardDraft,
    draftConflict: Boolean(draftConflict),
    restoreConflictingDraft,
    useLatestPublishedPlan,
    replaceFormData,
  };
}
