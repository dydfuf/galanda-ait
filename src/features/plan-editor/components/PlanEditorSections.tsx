import { css } from "@emotion/react";
import { Badge, CTAButton, FixedBottomCTA, List, ListHeader, ListRow, Text, Top } from "@toss/tds-mobile";
import { formatCostRangeText } from "../../../core/calculations/plan-cost.ts";
import { fixedCtaContainerStyle } from "../../common/tds-layout.ts";
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

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const listStyle = css`
  margin-bottom: 20px;
`;

const sectionFormStyle = css`
  padding-bottom: var(--app-cta-space, 112px);
`;

const conflictActionsStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 20px;
`;

function statusBadge(label: string, complete: boolean): JSX.Element {
  return (
    <Badge size="small" variant="weak" color={complete ? "blue" : "elephant"}>
      {label}
    </Badge>
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
    <ListRow
      border="indented"
      verticalPadding="medium"
      horizontalPadding="small"
      withTouchEffect
      arrowType="right"
      onClick={onClick}
      contents={
        <div css={contentsStyle}>
          <Text typography="t6" fontWeight="bold">{title}</Text>
          <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">{summary}</Text>
        </div>
      }
      right={statusBadge(status, complete)}
    />
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
    editor.routes.every((route) => route.city.trim() && route.nights > 0) &&
    editor.currentTotalNights === editor.totalTripNights;
  const accommodationChecks = editor.accommodations.filter(
    (item) => item.isSearching || item.bookingStatus !== "AVAILABLE"
  ).length;
  const transportChecks = editor.transports.filter(
    (item) => item.bookingStatus !== "AVAILABLE"
  ).length;

  if (editor.draftConflict) {
    return (
      <>
        <Top
          title={<Top.TitleParagraph>공개된 여행안이 변경됐어요</Top.TitleParagraph>}
          subtitleBottom={
            <Top.SubtitleParagraph>
              저장된 임시안은 이전 공개본을 기준으로 작성됐습니다. 사용할 내용을 선택해주세요.
            </Top.SubtitleParagraph>
          }
        />
        <div css={conflictActionsStyle} role="alert">
          <CTAButton variant="weak" onClick={editor.restoreConflictingDraft}>
            이전 임시안 복원
          </CTAButton>
          <CTAButton onClick={editor.useLatestPublishedPlan}>
            최신 공개본으로 시작
          </CTAButton>
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
          lastSavedTime={editor.lastSavedTime}
          onClearDraft={editor.clearDraft}
        />

        {isCloneMode && editor.diffFromOriginal && cloneTitle && (
          <DiffBanner diff={editor.diffFromOriginal} originalTitle={cloneTitle} />
        )}

        <ListHeader
          size="small"
          title={<ListHeader.TitleParagraph>여행안 구성</ListHeader.TitleParagraph>}
          description={
            <ListHeader.DescriptionParagraph>
              항목을 하나씩 열어 내용을 정리해주세요.
            </ListHeader.DescriptionParagraph>
          }
        />
        <List aria-label="여행안 편집 항목" css={listStyle}>
          <SummaryRow
            title="기본 정보"
            summary={editor.title.trim() || "여행안 이름을 입력해주세요."}
            status={editor.title.trim() ? "완료" : "입력 필요"}
            complete={Boolean(editor.title.trim())}
            onClick={() => onOpenSection("basic")}
          />
          <SummaryRow
            title="여행 경로"
            summary={editor.routes.map((route) => `${route.city || "도시 미정"} ${route.nights}박`).join(" · ")}
            status={routeComplete ? "완료" : "확인 필요"}
            complete={routeComplete}
            onClick={() => onOpenSection("route")}
          />
          <SummaryRow
            title="숙소"
            summary={`${editor.accommodations.length}곳${accommodationChecks ? ` · 확인 필요 ${accommodationChecks}곳` : ""}`}
            status={accommodationChecks ? "확인 필요" : "완료"}
            complete={accommodationChecks === 0}
            onClick={() => onOpenSection("accommodation")}
          />
          <SummaryRow
            title="교통"
            summary={editor.transports.map((item) => item.mode).filter(Boolean).join(" · ") || "교통편 없음"}
            status={transportChecks ? "확인 필요" : "완료"}
            complete={transportChecks === 0}
            onClick={() => onOpenSection("transport")}
          />
          <ListRow
            border="none"
            verticalPadding="medium"
            horizontalPadding="small"
            contents={
              <div css={contentsStyle}>
                <Text typography="t6" fontWeight="bold">예상 비용</Text>
                <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                  {editor.costSummary.baseHeadcount}명 기준 1인 예상 참고액
                </Text>
              </div>
            }
            right={<Text typography="t6" fontWeight="bold">{perPersonCost}</Text>}
          />
        </List>
      </>
    );
  }

  return (
    <>
      <Top
        title={
          <Top.TitleParagraph>
            {section === "basic"
              ? "기본 정보"
              : section === "route"
                ? "여행 경로"
                : section === "accommodation"
                  ? "숙소"
                  : "교통"}
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph>
            입력한 내용은 임시안에 자동 저장돼요.
          </Top.SubtitleParagraph>
        }
      />

      <form css={sectionFormStyle} onSubmit={(event) => event.preventDefault()}>
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

      <FixedBottomCTA containerStyle={fixedCtaContainerStyle} onClick={onCompleteSection}>
        편집 완료
      </FixedBottomCTA>
    </>
  );
}
