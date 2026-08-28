import { formatCostRangeText } from "../../../core/calculations/plan-cost.ts";
import type { TripActionId } from "../../../core/domain/trip-action.ts";
import type { RecommendNextActionResponse } from "../../../contracts/recommendation.ts";
import {
  getPlanPublishCompletion,
  getStayNightCount,
} from "../../../core/domain/room.ts";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import type { usePlanEditorState } from "../hooks/usePlanEditorState.ts";
import {
  PLAN_EDITOR_SECTION_PRESENTATION,
  type PlanEditorSection,
} from "../plan-editor-section.ts";
import { tripActionPresentation } from "../../common/trip-action-presentation.ts";
import {
  NextActionRecommendation,
  NextActionRecommendationPending,
} from "../../common/NextActionRecommendation.tsx";
import type { RecommendationActionContext } from "../../common/recommendation.ts";
import { AccommodationSection } from "./AccommodationSection.tsx";
import { BasicInfoSection } from "./BasicInfoSection.tsx";
import { DiffBanner } from "./DiffBanner.tsx";
import { PlanEditorHeader } from "./PlanEditorHeader.tsx";
import { RouteCitySection } from "./RouteCitySection.tsx";
import { TransportSection } from "./TransportSection.tsx";

type EditorState = ReturnType<typeof usePlanEditorState>;

interface PlanEditorSectionsProps {
  readonly editor: EditorState;
  readonly section?: PlanEditorSection;
  readonly isEditMode: boolean;
  readonly isCloneMode: boolean;
  readonly cloneTitle?: string;
  readonly tripId?: string;
  readonly isFirstPlan?: boolean;
  readonly recommendedActionId?: TripActionId;
  readonly recommendation?: RecommendNextActionResponse;
  readonly isRecommendationPending?: boolean;
  readonly onRecommendationAction?: (context: RecommendationActionContext) => void;
  readonly onRecommendationDismiss?: (recommendationId: string) => void;
  readonly onOpenSection: (section: PlanEditorSection) => void;
  readonly onCompleteSection: () => void;
}

export function RevisionConflictChoice({
  message,
  onReapply,
  onUseLatest,
}: {
  readonly message: string;
  readonly onReapply: () => void;
  readonly onUseLatest: () => void;
}): JSX.Element {
  return (
    <div role="alert">
      <PageTitle
        className="px-0"
        title="다른 변경이 먼저 반영됐어요"
        description={message}
      />
      <div className="flex flex-col gap-2 pt-2">
        <Button type="button" size="xl" variant="secondary" onClick={onReapply}>
          내 변경 다시 적용
        </Button>
        <Button type="button" size="xl" onClick={onUseLatest}>
          최신 공개본 사용
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({
  title,
  summary,
  status,
  complete,
  onClick,
}: {
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly complete: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <MobileListItem
      chevron
      onClick={onClick}
      className="px-3"
      trailing={<Badge variant={complete ? "info" : "neutral"}>{status}</Badge>}
    >
      <ItemTitle className="text-base leading-snug">{title}</ItemTitle>
      <ItemDescription className="text-base leading-relaxed">
        {summary}
      </ItemDescription>
    </MobileListItem>
  );
}

export function PlanEditorSections({
  editor,
  section,
  isEditMode,
  isCloneMode,
  cloneTitle,
  tripId,
  isFirstPlan = false,
  recommendedActionId,
  recommendation,
  isRecommendationPending = false,
  onRecommendationAction,
  onRecommendationDismiss,
  onOpenSection,
  onCompleteSection,
}: PlanEditorSectionsProps): JSX.Element {
  const {
    basic: basicComplete,
    route: routeComplete,
    accommodation: accommodationComplete,
    transport: transportComplete,
  } = getPlanPublishCompletion(editor);
  const accommodationEmpty = editor.accommodations.length === 0;
  const transportEmpty = editor.transports.length === 0;

  if (editor.draftConflict) {
    return (
      <>
        <PageTitle
          className="px-0"
          title="공개된 여행안이 변경됐어요"
          description="저장된 임시안은 이전 공개본을 기준으로 작성됐습니다. 사용할 내용을 선택해주세요."
        />
        <div className="flex flex-col gap-2 pt-2" role="alert">
          <Button type="button" size="xl" variant="secondary" onClick={editor.restoreConflictingDraft}>
            이전 임시안 복원
          </Button>
          <Button type="button" size="xl" onClick={editor.useLatestPublishedPlan}>
            최신 공개본으로 시작
          </Button>
        </div>
      </>
    );
  }

  if (!section) {
    const perPersonCost = editor.costSummary.hasCost
      ? formatCostRangeText(
          editor.costSummary.minPerPerson,
          editor.costSummary.maxPerPerson,
          editor.costSummary.unpricedCount
        )
      : "가격 미정";

    const isFirstPlanGuide = isFirstPlan && !isEditMode && !isCloneMode;
    const completedCount = [
      basicComplete,
      routeComplete,
      accommodationComplete,
      transportComplete,
    ].filter(Boolean).length;
    const nextRecommended = recommendedActionId
      ? tripActionPresentation[recommendedActionId].section
      : undefined;

    return (
      <>
        <PlanEditorHeader
          isEditMode={isEditMode}
          isCloneMode={isCloneMode}
          draftSaveStatus={editor.draftSaveStatus}
          onClearDraft={editor.clearDraft}
        />

        {isCloneMode && editor.diffFromOriginal && cloneTitle && (
          <DiffBanner
            diff={editor.diffFromOriginal}
            originalTitle={cloneTitle}
          />
        )}

        {isFirstPlanGuide ? (
          <div className="px-0 pb-3">
            <SectionHeader
              className="px-0 pt-0 [&_p]:text-base"
              title="첫 여행안을 만들어볼까요?"
              description={`필수 정보 ${completedCount}/4 완료 · 항목을 하나씩 열어 정리해주세요.`}
            />
            <p className="pt-2 text-base leading-relaxed text-muted-foreground">
              아직 예약하지 않았어도 괜찮아요. 정하지 못한 숙소/교통은 찾는
              중·확인 전으로 남길 수 있어요.
            </p>
          </div>
        ) : (
          <SectionHeader
            className="px-0 [&_p]:text-base"
            title="여행안 구성"
            description="항목을 하나씩 열어 내용을 정리해주세요."
          />
        )}
        {isFirstPlanGuide &&
          tripId &&
          recommendation &&
          onRecommendationAction && (
            <NextActionRecommendation
              tripId={tripId}
              surface="FIRST_PLAN"
              recommendation={recommendation}
              onAction={onRecommendationAction}
              onDismiss={onRecommendationDismiss}
              className="mx-0"
            />
          )}
        {isFirstPlanGuide && isRecommendationPending && (
          <NextActionRecommendationPending className="mx-0" />
        )}
        <MobileList
          aria-label="여행안 편집 항목"
          className="mb-5 overflow-hidden rounded-2xl border border-border bg-surface-content"
          data-galanda-surface="content"
        >
          <SummaryRow
            title={PLAN_EDITOR_SECTION_PRESENTATION.basic.summaryTitle}
            summary={editor.title.trim() || "여행안 이름을 입력해주세요."}
            status={
              isFirstPlanGuide && nextRecommended === "basic" && !basicComplete
                ? "다음으로 추천"
                : basicComplete
                  ? "완료"
                  : "입력 필요"
            }
            complete={basicComplete}
            onClick={() => onOpenSection("basic")}
          />
          <SummaryRow
            title={PLAN_EDITOR_SECTION_PRESENTATION.route.summaryTitle}
            summary={
              editor.routes.length > 0
                ? editor.routes
                    .map(
                      (route) =>
                        `${route.city || "도시 미정"} ${Math.max(0, getStayNightCount(route))}박`,
                    )
                    .join(" · ")
                : "방문 도시와 날짜를 정해주세요."
            }
            status={
              isFirstPlanGuide && nextRecommended === "route" && !routeComplete
                ? "다음으로 추천"
                : routeComplete
                  ? "완료"
                  : editor.routes.length > 0
                    ? "확인 필요"
                    : "입력 필요"
            }
            complete={routeComplete}
            onClick={() => onOpenSection("route")}
          />
          <SummaryRow
            title={PLAN_EDITOR_SECTION_PRESENTATION.accommodation.summaryTitle}
            summary={
              accommodationEmpty
                ? "아직 추가하지 않았어요"
                : `${editor.accommodations.length}곳`
            }
            status={
              isFirstPlanGuide &&
              nextRecommended === "accommodation" &&
              !accommodationComplete
                ? "다음으로 추천"
                : !accommodationComplete
                  ? accommodationEmpty
                    ? "입력 전"
                    : "확인 필요"
                  : "완료"
            }
            complete={accommodationComplete}
            onClick={() => onOpenSection("accommodation")}
          />
          <SummaryRow
            title={PLAN_EDITOR_SECTION_PRESENTATION.transport.summaryTitle}
            summary={
              transportEmpty
                ? "아직 추가하지 않았어요"
                : editor.transports
                    .map((item) => item.mode.trim() || "교통편 확인 전")
                    .join(" · ")
            }
            status={
              isFirstPlanGuide &&
              nextRecommended === "transport" &&
              !transportComplete
                ? "다음으로 추천"
                : !transportComplete
                  ? transportEmpty
                    ? "입력 전"
                    : "확인 필요"
                  : "완료"
            }
            complete={transportComplete}
            onClick={() => onOpenSection("transport")}
          />
          <MobileListItem
            className="px-3"
            trailing={
              <span className="text-base font-bold text-foreground">
                {perPersonCost}
              </span>
            }
          >
            <ItemTitle className="text-base leading-snug">예상 비용</ItemTitle>
            <ItemDescription className="text-base leading-relaxed">
              {editor.costSummary.baseHeadcount}명 기준 1인 예상 참고액
            </ItemDescription>
          </MobileListItem>
        </MobileList>
      </>
    );
  }

  return (
    <>
      <PageTitle
        className="px-0"
        title={PLAN_EDITOR_SECTION_PRESENTATION[section].summaryTitle}
        description="입력한 내용은 임시안에 자동 저장돼요."
      />

      <form
        className="min-w-0 bg-surface-content pb-(--app-cta-space)"
        data-galanda-surface="content"
        onSubmit={(event) => event.preventDefault()}
      >
        {section === "basic" && (
          <BasicInfoSection
            title={editor.title}
            onTitleChange={editor.setTitle}
            proposalReason={editor.proposalReason}
            onProposalReasonChange={editor.setProposalReason}
            baseHeadcount={editor.baseHeadcount}
            onBaseHeadcountChange={editor.setBaseHeadcount}
          />
        )}
        {section === "route" && (
          <RouteCitySection
            routes={editor.routes}
            totalTripNights={editor.totalTripNights}
            currentTotalNights={editor.currentTotalNights}
            differenceSummary={editor.diffFromOriginal?.summaryText}
            onAddCity={editor.handleAddCity}
            onUpdateCity={editor.handleUpdateCity}
            onRemoveCity={editor.handleRemoveCity}
          />
        )}
        {section === "accommodation" && (
          <AccommodationSection
            accommodations={editor.accommodations}
            routes={editor.routes}
            onAdd={editor.handleAddAccommodation}
            onUpdate={editor.handleUpdateAccommodation}
            onRemove={editor.handleRemoveAccommodation}
          />
        )}
        {section === "transport" && (
          <TransportSection
            transports={editor.transports}
            onAdd={editor.handleAddTransport}
            onUpdate={editor.handleUpdateTransport}
            onRemove={editor.handleRemoveTransport}
          />
        )}
      </form>

      <BottomAction>
        <Button type="button" size="xl" onClick={onCompleteSection}>
          편집 완료
        </Button>
      </BottomAction>
    </>
  );
}
