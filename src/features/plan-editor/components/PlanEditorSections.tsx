import { formatCostRangeText } from "../../../core/calculations/plan-cost.ts";
import { getStayNightCount } from "../../../core/domain/room.ts";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import type { usePlanEditorState } from "../hooks/usePlanEditorState.ts";
import type { PlanEditorSection } from "../plan-editor-section.ts";
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
  readonly onOpenSection: (section: PlanEditorSection) => void;
  readonly onCompleteSection: () => void;
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
      className="px-2"
      trailing={<Badge variant={complete ? "info" : "neutral"}>{status}</Badge>}
    >
      <ItemTitle>{title}</ItemTitle>
      <ItemDescription>{summary}</ItemDescription>
    </MobileListItem>
  );
}

export function PlanEditorSections({
  editor,
  section,
  isEditMode,
  isCloneMode,
  cloneTitle,
  onOpenSection,
  onCompleteSection,
}: PlanEditorSectionsProps): JSX.Element {
  const routeComplete =
    editor.routes.length > 0 &&
    editor.routes.every((route) => route.city.trim() && getStayNightCount(route) > 0);
  const accommodationChecks = editor.accommodations.filter(
    (item) => item.isSearching || item.bookingStatus !== "AVAILABLE"
  ).length;
  const transportChecks = editor.transports.filter(
    (item) => item.bookingStatus !== "AVAILABLE"
  ).length;
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
      ? formatCostRangeText(editor.costSummary.minPerPerson, editor.costSummary.maxPerPerson)
      : "가격 미정";

    return (
      <>
        <PlanEditorHeader
          isEditMode={isEditMode}
          isCloneMode={isCloneMode}
          draftSaveStatus={editor.draftSaveStatus}
          onClearDraft={editor.clearDraft}
        />

        {isCloneMode && editor.diffFromOriginal && cloneTitle && (
          <DiffBanner diff={editor.diffFromOriginal} originalTitle={cloneTitle} />
        )}

        <SectionHeader
          className="px-0"
          title="여행안 구성"
          description="항목을 하나씩 열어 내용을 정리해주세요."
        />
        <MobileList aria-label="여행안 편집 항목" className="mb-5">
          <SummaryRow
            title="기본 정보"
            summary={editor.title.trim() || "여행안 이름을 입력해주세요."}
            status={editor.title.trim() ? "완료" : "입력 필요"}
            complete={Boolean(editor.title.trim())}
            onClick={() => onOpenSection("basic")}
          />
          <SummaryRow
            title="여행 경로"
            summary={editor.routes.length > 0
              ? editor.routes.map((route) => `${route.city || "도시 미정"} ${Math.max(0, getStayNightCount(route))}박`).join(" · ")
              : "방문 도시와 날짜를 정해주세요."}
            status={routeComplete ? "완료" : editor.routes.length > 0 ? "확인 필요" : "입력 필요"}
            complete={routeComplete}
            onClick={() => onOpenSection("route")}
          />
          <SummaryRow
            title="숙소"
            summary={accommodationEmpty
              ? "아직 추가하지 않았어요"
              : `${editor.accommodations.length}곳${accommodationChecks ? ` · 확인 필요 ${accommodationChecks}곳` : ""}`}
            status={accommodationEmpty ? "입력 전" : accommodationChecks ? "확인 필요" : "완료"}
            complete={!accommodationEmpty && accommodationChecks === 0}
            onClick={() => onOpenSection("accommodation")}
          />
          <SummaryRow
            title="교통"
            summary={transportEmpty
              ? "아직 추가하지 않았어요"
              : editor.transports.map((item) => item.mode).filter(Boolean).join(" · ")}
            status={transportEmpty ? "입력 전" : transportChecks ? "확인 필요" : "완료"}
            complete={!transportEmpty && transportChecks === 0}
            onClick={() => onOpenSection("transport")}
          />
          <MobileListItem
            className="px-2"
            trailing={<span className="text-[15px] font-bold text-foreground">{perPersonCost}</span>}
          >
            <ItemTitle>예상 비용</ItemTitle>
            <ItemDescription>
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
        title={
          section === "basic"
            ? "기본 정보"
            : section === "route"
              ? "여행 경로"
              : section === "accommodation"
                ? "숙소"
                : "교통"
        }
        description="입력한 내용은 임시안에 자동 저장돼요."
      />

      <form className="pb-(--app-cta-space)" onSubmit={(event) => event.preventDefault()}>
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
