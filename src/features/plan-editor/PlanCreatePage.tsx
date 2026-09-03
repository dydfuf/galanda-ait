import { useRef, useState, useMemo } from "react";
import { css } from "@emotion/react";
import {
  Navigate,
  useLocation,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Result } from "effect";
import {
  decodeRouteParams,
  TripParamsSchema,
} from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { TripCreationProgress } from "@/components/galanda/trip-creation-progress.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { usePlanEditorState } from "./hooks/usePlanEditorState.ts";
import { PlanEditorSections } from "./components/PlanEditorSections.tsx";
import { FirstPlanWizard } from "./components/FirstPlanWizard.tsx";
import {
  isPlanEditorSection,
  type PlanEditorSection,
} from "./plan-editor-section.ts";
import { ValidationBanner } from "./components/ValidationBanner.tsx";
import { useCreatePlanMutation } from "./mutations.ts";
import {
  isRevisionConflict,
  isStateConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../common/error-message.ts";
import {
  getRoomActor,
  isRoomConfirmed,
} from "../../core/domain/auth-guards.ts";
import { resolveEligibleTripActions } from "../../core/domain/trip-action-resolver.ts";
import { toFirstPlanDecisionContext } from "../../core/domain/trip-decision.ts";
import {
  getPlanPublishCompletion,
  getStayNightCount,
  type AccommodationSnapshot,
  type TransportSnapshot,
} from "../../core/domain/room.ts";
import { useNextTripActionRecommendation } from "../common/use-next-trip-action-recommendation.ts";
import {
  getRecommendationActionContext,
  trackRecommendationEvent,
  type RecommendationActionContext,
} from "../common/recommendation.ts";
import { tripActionPresentation } from "../common/trip-action-presentation.ts";
import { shareTripInvite } from "../invite/share-trip-invite.ts";
import { OFFLINE_MUTATION_MESSAGE } from "../../app/offline-mutation.ts";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";
import {
  parseWizardCursor,
  serializeWizardCursor,
  normalizeWizardCursor,
  getNextWizardCursor,
  getPreviousWizardCursor,
  mapValidationErrorToCursor,
  FIRST_PLAN_SECTION_DEFAULT_QUESTIONS,
  type FirstPlanWizardCursor,
} from "./first-plan-wizard-flow.ts";

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: 15px;
`;

const errorMessageStyle = css`
  display: block;
  font-size: 16px;
  color: var(--destructive-strong);
  margin: 8px 0 0 0;
  text-align: center;
  line-height: 1.5;
`;

interface PlanCreateLocationState {
  readonly allowIncompleteWizardProgress?: boolean;
  readonly fromEditorSummary?: boolean;
  readonly tripCreationWizard?: boolean;
  readonly wizardReview?: boolean;
  readonly wizardEntrySource?: "companions" | "plans";
}

export function PlanCreatePage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as PlanCreateLocationState | null;
  const cloneFromPlanId = searchParams.get("cloneFrom");
  const section = isPlanEditorSection(params.section)
    ? params.section
    : undefined;

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const editorBasePath = `/trips/${tripId}/plans/new`;

  const {
    data: room,
    isLoading,
    isError,
    refetch,
  } = useTripRoomRawQuery(tripId);
  const {
    data: session,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
  } = useSessionQuery();
  const createPlanMutation = useCreatePlanMutation();
  const isSubmittingRef = useRef(false);
  const isOnline = useOnlineStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeRecommendation, setActiveRecommendation] = useState<
    RecommendationActionContext | undefined
  >(() => getRecommendationActionContext(location.state));
  const [dismissedRecommendationId, setDismissedRecommendationId] =
    useState<string>();
  const isSubmitPending = isSubmitting || createPlanMutation.isPending;

  // 1. Mode Determination
  const cloneFromPlan = room?.plans.find((p) => p.id === cloneFromPlanId);
  const isCloneMode = Boolean(cloneFromPlan);
  const isFirstPlan = Boolean(!cloneFromPlan && room?.plans.length === 0);

  // 2. Parse Cursor from URL
  const parsedCursor = useMemo(
    () => parseWizardCursor(searchParams, location.pathname),
    [searchParams, location.pathname]
  );

  // 3. Connect usePlanEditorState
  const editor = usePlanEditorState(
    room,
    undefined,
    cloneFromPlan,
    session?.participantId,
    false,
    !isCloneMode ? parsedCursor : undefined
  );

  const isWizardMode = !isCloneMode && (
    isFirstPlan ||
    Boolean(locationState?.tripCreationWizard) ||
    editor.savedWizardCursor !== undefined
  );

  // 4. Normalize Cursor against hydrated form state
  const currentCursor = useMemo(
    () => (isWizardMode ? normalizeWizardCursor(parsedCursor, editor) : parsedCursor),
    [isWizardMode, parsedCursor, editor]
  );

  // 5. URL Cursor Synchronization
  const serializedCursor = useMemo(
    () => (isWizardMode ? serializeWizardCursor(currentCursor, tripId) : undefined),
    [isWizardMode, currentCursor, tripId]
  );

  const draftCompletion = getPlanPublishCompletion(editor);
  const isAlternativePlanDraft = isWizardMode && (room?.plans.length ?? 0) > 0;

  const recommendationQuery = useNextTripActionRecommendation(
    tripId,
    {
      surface: "FIRST_PLAN",
      draft: {
        ...draftCompletion,
        conflict: editor.draftConflict ? "DRAFT" : undefined,
      },
    },
    room?.revision,
    isFirstPlan && !isAlternativePlanDraft && !editor.draftConflict
  );

  // Forward Navigation Handler
  const handleNextQuestion = (): void => {
    let updatedEditor = editor;

    if (currentCursor.section === "accommodation" && currentCursor.question === "status") {
      const idx = currentCursor.index ?? 0;
      if (!editor.accommodations[idx]) {
        const route = editor.routes[idx];
        const newAcc: AccommodationSnapshot = {
          id: `acc-${idx + 1}`,
          city: route?.city ?? "",
          period: route?.arrivalDate && route?.departureDate ? `${route.arrivalDate} ~ ${route.departureDate}` : "",
          nights: Math.max(0, getStayNightCount(route ?? { city: "", arrivalDate: "", departureDate: "" })),
          hotelName: "",
          isSearching: true,
          bookingStatus: "NOT_CHECKED",
        };
        editor.handleAddAccommodation(newAcc);
        updatedEditor = {
          ...editor,
          accommodations: [...editor.accommodations, newAcc],
        };
      }
    }

    if (currentCursor.section === "transport") {
      const idx = currentCursor.index ?? 0;
      if (!editor.transports[idx]) {
        const totalLegs = Math.max(1, editor.routes.length + 1);
        const defaultProposedFrom = idx === 0 ? "" : (editor.routes[idx - 1]?.city ?? "");
        const defaultProposedTo = idx === totalLegs - 1 ? "" : (editor.routes[idx]?.city ?? "");
        if (defaultProposedFrom && defaultProposedTo) {
          const newTr: TransportSnapshot = {
            id: `tr-${idx + 1}`,
            fromCity: defaultProposedFrom,
            toCity: defaultProposedTo,
            mode: "",
            hasTransfer: false,
            durationText: "",
            bookingStatus: "NOT_CHECKED",
          };
          editor.handleAddTransport(newTr);
          updatedEditor = {
            ...updatedEditor,
            transports: [...updatedEditor.transports, newTr],
          };
        }
      }
    }

    const nextCursor = getNextWizardCursor(currentCursor, updatedEditor);
    const { pathname, search } = serializeWizardCursor(nextCursor, tripId);
    navigate(`${pathname}${search}`, {
      replace: true,
      state: {
        ...locationState,
        tripCreationWizard: true,
        wizardReview: nextCursor.section === "review" ? true : undefined,
      },
    });
  };

  // Route City Addition Handler
  const handleAddCity = (city: string = ""): void => {
    const nextIndex = editor.routes.length;
    editor.handleAddCity(city);
    const nextCursor: FirstPlanWizardCursor = {
      section: "route",
      question: "city",
      index: nextIndex,
    };
    const { pathname, search } = serializeWizardCursor(nextCursor, tripId);
    navigate(`${pathname}${search}`, {
      replace: true,
      state: {
        ...locationState,
        tripCreationWizard: true,
      },
    });
  };

  // Backward Navigation Handler
  const handlePreviousQuestion = (): void => {
    if (
      currentCursor.section === "basic" &&
      currentCursor.question === "title" &&
      !currentCursor.returnToReview
    ) {
      navigate(
        locationState?.wizardEntrySource === "companions"
          ? `/trips/${tripId}/setup/companions`
          : `/trips/${tripId}/plans`,
        { replace: true }
      );
      return;
    }

    if (currentCursor.returnToReview) {
      if (currentCursor.section === "accommodation" && currentCursor.question === "status") {
        const idx = currentCursor.index ?? 0;
        if (!editor.accommodations[idx]) {
          const route = editor.routes[idx];
          editor.handleAddAccommodation({
            id: `acc-${idx + 1}`,
            city: route?.city ?? "",
            period: route?.arrivalDate && route?.departureDate ? `${route.arrivalDate} ~ ${route.departureDate}` : "",
            nights: Math.max(0, getStayNightCount(route ?? { city: "", arrivalDate: "", departureDate: "" })),
            hotelName: "",
            isSearching: true,
            bookingStatus: "NOT_CHECKED",
          });
        }
      }
      navigate(editorBasePath, {
        replace: true,
        state: {
          ...locationState,
          tripCreationWizard: true,
          wizardReview: true,
        },
      });
      return;
    }

    const prevCursor = getPreviousWizardCursor(currentCursor, editor);
    const { pathname, search } = serializeWizardCursor(prevCursor, tripId);
    navigate(`${pathname}${search}`, {
      replace: true,
      state: {
        ...locationState,
        tripCreationWizard: true,
      },
    });
  };

  // Skip Navigation Handler
  const handleSkipQuestion = (): void => {
    if (currentCursor.section === "basic" && currentCursor.question === "proposal-reason") {
      editor.setProposalReason("");
      handleNextQuestion();
      return;
    }
    if (currentCursor.section === "accommodation" && currentCursor.question === "status") {
      const idx = currentCursor.index ?? 0;
      const currentAcc = editor.accommodations[idx];
      if (currentAcc) {
        editor.handleUpdateAccommodation(currentAcc.id, {
          isSearching: true,
          hotelName: "",
          bookingStatus: "NOT_CHECKED",
        });
      }
      handleNextQuestion();
      return;
    }
    if (currentCursor.section === "transport" && currentCursor.question === "status") {
      const idx = currentCursor.index ?? 0;
      const currentTr = editor.transports[idx];
      if (currentTr) {
        editor.handleUpdateTransport(currentTr.id, {
          bookingStatus: "NOT_CHECKED",
          mode: "",
          durationText: "",
        });
      }
      handleNextQuestion();
      return;
    }
    handleNextQuestion();
  };

  // Review Edit Jump Handler
  const handleEditSectionFromReview = (targetSection: PlanEditorSection): void => {
    let targetCursor: FirstPlanWizardCursor;
    if (editor.validation.firstError) {
      const errorCursor = mapValidationErrorToCursor(editor.validation.firstError, editor);
      if (errorCursor.section === targetSection) {
        targetCursor = { ...errorCursor, returnToReview: true };
      } else {
        targetCursor = {
          section: targetSection,
          question: FIRST_PLAN_SECTION_DEFAULT_QUESTIONS[targetSection],
          ...(targetSection !== "basic" ? { index: 0 } : {}),
          returnToReview: true,
        };
      }
    } else {
      targetCursor = {
        section: targetSection,
        question: FIRST_PLAN_SECTION_DEFAULT_QUESTIONS[targetSection],
        ...(targetSection !== "basic" ? { index: 0 } : {}),
        returnToReview: true,
      };
    }
    const { pathname, search } = serializeWizardCursor(targetCursor, tripId);
    navigate(`${pathname}${search}`, {
      replace: true,
      state: {
        ...locationState,
        tripCreationWizard: true,
      },
    });
  };

  // Submission Handler
  const handleSubmit = async (
    recommendation = activeRecommendation,
  ): Promise<void> => {
    if (
      !room ||
      !editor.validation.isValid ||
      !isOnline ||
      isSubmitPending ||
      isSubmittingRef.current
    ) {
      if (!isOnline) setErrorMsg(OFFLINE_MUTATION_MESSAGE);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const command = {
        title: editor.title.trim(),
        proposalReason: editor.proposalReason.trim() || undefined,
        baseHeadcount: editor.baseHeadcount,
        routes: editor.routes.map((r) => ({ ...r, city: r.city.trim() })),
        accommodations: [...editor.accommodations],
        transports: [...editor.transports],
        places: cloneFromPlan?.places ?? [],
        cloneFromPlanId: cloneFromPlan ? cloneFromPlan.id : undefined,
      };

      const updatedRoom = await createPlanMutation.mutateAsync({
        roomId: tripId,
        expectedRevision: room.revision,
        ...command,
      });

      editor.discardDraft();
      const createdPlan = updatedRoom.plans[updatedRoom.plans.length - 1];
      if (createdPlan) {
        if (
          recommendation?.actionId === "PUBLISH_FIRST_PLAN" ||
          recommendation?.actionId === "PROPOSE_ALTERNATIVE"
        ) {
          trackRecommendationEvent(
            tripId,
            recommendation.recommendation,
            recommendation.surface,
            "nba_action_completed",
            recommendation.actionId,
          );
        }
        navigate(`/trips/${tripId}/plans/${createdPlan.id}`, { replace: true });
      }
    } catch (err: unknown) {
      if (isRevisionConflict(err) || isStateConflict(err)) {
        const refreshed = await refetch();
        if (refreshed.isError || !refreshed.data) {
          setErrorMsg(
            "최신 여행 상태를 불러오지 못했습니다. 다시 시도해주세요.",
          );
        } else if (isRevisionConflict(err)) {
          setErrorMsg(toRevisionConflictMessage(err));
        } else if (!isRoomConfirmed(refreshed.data)) {
          setErrorMsg(
            toUserMessage(
              err,
              "여행안을 등록하지 못했어요. 다시 시도해주세요.",
            ),
          );
        }
      } else {
        setErrorMsg(
          toUserMessage(err, "여행안을 등록하지 못했어요. 다시 시도해주세요."),
        );
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Section Editor (Non-wizard mode) handlers
  const openSection = (nextSection: PlanEditorSection): void => {
    navigate(`${editorBasePath}/${nextSection}${location.search}`, {
      state: {
        ...locationState,
        fromEditorSummary: true,
      },
    });
  };

  const completeSection = (): void => {
    navigate(`${editorBasePath}${location.search}`, { replace: true });
  };

  // Guard: Invalid Trip ID
  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  // Guard: Loading
  if (isLoading || isSessionLoading) {
    return (
      <div css={loadingContainerStyle}>여행방 정보를 불러오는 중입니다...</div>
    );
  }

  // Guard: Error
  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행방을 찾을 수 없습니다"
        message="요청하신 정보가 없거나 삭제되었습니다."
      />
    );
  }

  // Guard: Session Error
  if (isSessionError || !session) {
    return (
      <RouteErrorFallback
        title="로그인 정보를 확인할 수 없습니다"
        message={
          isSessionError
            ? toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")
            : "여행안을 작성하려면 로그인이 필요합니다."
        }
      />
    );
  }

  // Guard: Room Confirmed
  if (isRoomConfirmed(room)) {
    return (
      <RouteErrorFallback
        title="확정된 여행에서는 여행안을 만들 수 없습니다"
        message="확정 이후 변경은 확정 일정에서 진행해주세요."
        actionText="확정 일정 보기"
        onAction={() =>
          navigate(`/trips/${tripId}/itinerary`, { replace: true })
        }
      />
    );
  }

  // Guard: Draft Hydration for Wizard
  if (isWizardMode && !editor.isDraftHydrated) {
    return <div css={loadingContainerStyle}>임시안을 불러오는 중입니다...</div>;
  }

  // Guard: Stale wizard history after plan is published with no active draft
  if (
    locationState?.tripCreationWizard &&
    room.plans.length > 0 &&
    !cloneFromPlan &&
    !editor.savedWizardCursor &&
    !editor.title &&
    editor.routes.length === 0
  ) {
    return <Navigate to={`/trips/${tripId}/plans`} replace />;
  }

  // Synchronization Redirect if URL is out of sync with normalized cursor
  if (isWizardMode && serializedCursor) {
    const isCursorOutOfSync =
      location.pathname !== serializedCursor.pathname ||
      location.search !== serializedCursor.search;

    if (isCursorOutOfSync) {
      return (
        <Navigate
          to={`${serializedCursor.pathname}${serializedCursor.search}`}
          replace
          state={locationState}
        />
      );
    }
  }

  // Recommendations
  const actor = getRoomActor(room, session.participantIds);
  const deterministicActionId = isFirstPlan
    ? resolveEligibleTripActions(
        toFirstPlanDecisionContext(
          room,
          actor,
          draftCompletion,
          editor.draftConflict ? "DRAFT" : undefined,
        ),
        actor,
      )[0]?.actionId
    : undefined;
  const recommendation =
    recommendationQuery.data?.recommendationId === dismissedRecommendationId
      ? undefined
      : (recommendationQuery.data ?? undefined);
  const isRecommendationPending =
    isFirstPlan && !isAlternativePlanDraft && recommendationQuery.isPending;
  const recommendedActionId =
    recommendation?.primary.actionId ?? deterministicActionId;

  const runRecommendationAction = async (
    context: RecommendationActionContext,
  ): Promise<void> => {
    if (context.actionId === "INVITE_MEMBER") {
      const outcome = await shareTripInvite(tripId);
      if (outcome === "shared" || outcome === "copied") {
        trackRecommendationEvent(
          tripId,
          context.recommendation,
          context.surface,
          "nba_action_completed",
          context.actionId,
        );
      }
      return;
    }
    if (context.actionId === "PUBLISH_FIRST_PLAN") {
      await handleSubmit(context);
      return;
    }
    const nextSection = tripActionPresentation[context.actionId].section;
    if (nextSection) {
      setActiveRecommendation(context);
      if (isWizardMode) {
        handleEditSectionFromReview(nextSection);
      } else {
        openSection(nextSection);
      }
    }
  };

  // Render Subcase 1: Granular Question Screens
  if (isWizardMode && currentCursor.section !== "review") {
    return (
      <FirstPlanWizard
        cursor={currentCursor}
        editor={editor}
        tripId={tripId}
        isOnline={isOnline}
        onNext={handleNextQuestion}
        onPrevious={handlePreviousQuestion}
        onSkip={handleSkipQuestion}
        onAddCity={handleAddCity}
      />
    );
  }

  // Render Subcase 2: Review Mode (Wizard) OR Section Editor (Non-wizard)
  return (
    <PageBody
      withBottomAction={!editor.draftConflict}
      className="max-w-[640px] px-(--app-inline-padding)"
    >
      {isWizardMode && (
        <TripCreationProgress
          currentStep="plan-review"
          subStepLabel="검토·등록"
          className="mb-5"
        />
      )}

      <PlanEditorSections
        editor={editor}
        section={isWizardMode ? undefined : section}
        isEditMode={false}
        isCloneMode={isCloneMode}
        cloneTitle={cloneFromPlan?.title}
        tripId={tripId}
        isFirstPlan={isWizardMode}
        recommendedActionId={recommendedActionId}
        recommendation={recommendation}
        isRecommendationPending={isRecommendationPending}
        isReturningToSummary={Boolean(locationState?.fromEditorSummary)}
        onRecommendationAction={(context) =>
          void runRecommendationAction(context)
        }
        onRecommendationDismiss={setDismissedRecommendationId}
        onOpenSection={isWizardMode ? handleEditSectionFromReview : openSection}
        onCompleteSection={completeSection}
      />

      {(!section || isWizardMode) &&
        !editor.draftConflict &&
        !recommendation && (
          <BottomAction
            accessory={
              editor.validation.firstError || errorMsg || !isOnline ? (
                <>
                  {!isOnline && (
                    <span css={errorMessageStyle} role="status">
                      {OFFLINE_MUTATION_MESSAGE}
                    </span>
                  )}
                  {editor.validation.firstError && (
                    <ValidationBanner
                      firstError={editor.validation.firstError}
                      errorCount={editor.validation.errorCount}
                    />
                  )}
                  {errorMsg && (
                    <span css={errorMessageStyle} role="alert">
                      {errorMsg}
                    </span>
                  )}
                </>
              ) : undefined
            }
          >
            {isWizardMode && (
              <Button
                type="button"
                size="xl"
                variant="secondary"
                onClick={handlePreviousQuestion}
              >
                이전: 교통
              </Button>
            )}
            <Button
              type="button"
              size="xl"
              aria-busy={isSubmitPending || undefined}
              aria-live="polite"
              disabled={!editor.validation.isValid || isSubmitPending || !isOnline}
              onClick={() => void handleSubmit()}
            >
              {isSubmitPending && <Spinner aria-hidden="true" />}
              {isSubmitPending
                ? "등록 중..."
                : !isOnline
                  ? "온라인 연결 후 등록"
                  : cloneFromPlan
                    ? "대안 여행안 제안하기"
                    : isAlternativePlanDraft
                      ? "대안 여행안 등록하기"
                      : "여행안 제안 등록"}
            </Button>
          </BottomAction>
        )}
    </PageBody>
  );
}
