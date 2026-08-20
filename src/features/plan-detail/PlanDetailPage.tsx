import { useState } from "react";
import { css } from "@emotion/react";
import {
  Badge,
  BottomSheet,
  FixedBottomCTA,
  List,
  ListHeader,
  ListRow,
  Text,
  TextButton,
  useBottomSheet,
  useToast,
} from "@toss/tds-mobile";
import { useNavigate, useParams } from "react-router-dom";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "./queries.ts";
import { useSubmitOpinionMutation } from "./mutations.ts";
import { useDeletePlanMutation } from "../plan-editor/mutations.ts";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { RouteRail } from "../common/RouteRail.tsx";
import { BookingRiskSummary } from "./components/BookingRiskSummary.tsx";
import { DetailTimeline } from "./components/DetailTimeline.tsx";
import { OpinionBottomSheet, type ReactionType } from "./components/OpinionBottomSheet.tsx";
import { fixedCtaContainerStyle } from "../common/tds-layout.ts";

type PlanSheet = "cost" | "details" | "actions" | null;

const pageContainerStyle = css`
  box-sizing: border-box;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 16px 20px var(--app-cta-space, 112px);
`;

const summaryStyle = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 4px 20px;
`;

const metadataStyle = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`;

const proposalReasonStyle = css`
  margin: 0;
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 14px;
  line-height: 1.5;
`;

const listContentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const listRightTextStyle = css`
  max-width: 150px;
  text-align: right;
  white-space: normal;
`;

const secondaryListStyle = css`
  margin-bottom: 24px;
`;

const sheetListStyle = css`
  padding-bottom: 16px;
`;

const reactionLabels: Record<ReactionType, string> = {
  LIKE: "좋아요",
  OKAY: "괜찮아요",
  HARD: "어려워요",
};

const getPlanBadgeColor = (isConfirmed: boolean, planTag: string): "blue" | "green" | "elephant" =>
  isConfirmed ? "green" : planTag === "ALTERNATIVE" ? "elephant" : "blue";

export function PlanDetailPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const { isError: isSessionError, error: sessionError } = useSessionQuery();
  const { data: room, isLoading, isError, error } = useTripRoomDetailQuery(tripId);
  const submitOpinionMutation = useSubmitOpinionMutation();
  const deletePlanMutation = useDeletePlanMutation();
  const { openAsyncTwoButtonSheet } = useBottomSheet();
  const { openToast } = useToast();
  const [isOpinionSheetOpen, setIsOpinionSheetOpen] = useState(false);
  const [sheet, setSheet] = useState<PlanSheet>(null);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행안 경로입니다." />;
  }

  if (isLoading) {
    return (
      <div css={pageContainerStyle}>
        <Text typography="t6" color="var(--adaptiveGrey600, #6b7684)">
          여행안 상세 정보를 불러오는 중...
        </Text>
      </div>
    );
  }

  if (isSessionError) {
    return (
      <RouteErrorFallback
        title="로그인 정보를 확인할 수 없습니다"
        message={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
      />
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={toUserMessage(error, "요청한 정보를 찾을 수 없습니다.")}
      />
    );
  }

  const plan = room.plans.find((candidate) => candidate.id === planId);
  if (!plan) {
    return (
      <RouteErrorFallback
        title="여행안을 찾을 수 없습니다"
        message="요청하신 여행안이 삭제되었거나 존재하지 않습니다."
        actionText="계획 목록으로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
      />
    );
  }

  const isConfirmed = plan.id === room.confirmedPlanId;
  const isRoomConfirmed = Boolean(room.confirmedPlanId);
  const canChangeOpinion = !isRoomConfirmed;
  const canManage = !isRoomConfirmed && !isConfirmed && Boolean(plan.canManage);
  const opinionSummary = `좋아요 ${plan.opinions.likeCount} · 괜찮아요 ${plan.opinions.okayCount} · 어려워요 ${plan.opinions.hardCount}`;
  const myOpinionSummary = plan.myReaction
    ? `내 의견: ${reactionLabels[plan.myReaction]}`
    : "아직 내 의견이 없어요";

  const handleOpinionSubmit = async (
    reaction: ReactionType,
    reason?: string
  ): Promise<void> => {
    if (submitOpinionMutation.isPending) return;

    try {
      await submitOpinionMutation.mutateAsync({
        roomId: room.id,
        planId: plan.id,
        reaction,
        reason,
        expectedRevision: room.revision,
      });
      setIsOpinionSheetOpen(false);
      openToast("의견을 저장했어요.");
    } catch (err: unknown) {
      openToast(toUserMessage(err, "의견을 등록하지 못했습니다."));
    }
  };

  const handleDeletePlan = async (): Promise<void> => {
    if (deletePlanMutation.isPending) return;

    await openAsyncTwoButtonSheet({
      header: (
        <>
          <BottomSheet.Header>여행안을 삭제할까요?</BottomSheet.Header>
          <BottomSheet.HeaderDescription>
            '{plan.title}' 여행안과 작성한 내용이 삭제됩니다.
          </BottomSheet.HeaderDescription>
        </>
      ),
      leftButton: "취소",
      rightButton: "삭제하기",
      onRightButtonClick: async (): Promise<void> => {
        try {
          await deletePlanMutation.mutateAsync({
            roomId: room.id,
            planId: plan.id,
            expectedRevision: room.revision,
          });
          navigate(`/trips/${tripId}/plans`, { replace: true });
        } catch (err: unknown) {
          openToast(toUserMessage(err, "여행안 삭제에 실패했습니다."));
        }
      },
    });
  };

  return (
    <div css={pageContainerStyle}>
      <ListHeader
        size="large"
        descriptionPosition="bottom"
        title={<ListHeader.TitleParagraph>{plan.title}</ListHeader.TitleParagraph>}
        description={
          <ListHeader.DescriptionParagraph>
            <span css={metadataStyle}>
              <Badge
                size="small"
                variant={isConfirmed ? "fill" : "weak"}
                color={getPlanBadgeColor(isConfirmed, plan.planTag)}
              >
                {isConfirmed ? "확정안" : plan.planTagLabel}
              </Badge>
              <span>
                제안자 {plan.authorName} · {plan.period} · {plan.nights}박 {plan.days}일
              </span>
            </span>
          </ListHeader.DescriptionParagraph>
        }
        right={
          canManage ? (
            <TextButton
              size="medium"
              variant="clear"
              color="var(--adaptiveBlue500, #3182f6)"
              onClick={() => setSheet("actions")}
            >
              더보기
            </TextButton>
          ) : undefined
        }
      />

      <section css={summaryStyle} aria-label="여행안 요약">
        <RouteRail route={plan.route} differenceSummary={plan.differenceSummary} />
        {plan.proposalReason && <p css={proposalReasonStyle}>“{plan.proposalReason}”</p>}
      </section>

      <List aria-label="여행안 핵심 정보">
        <ListRow
          border="indented"
          verticalPadding="medium"
          horizontalPadding="small"
          withTouchEffect
          arrowType="right"
          onClick={() => setSheet("cost")}
          aria-label={`예상 경비, ${plan.perPersonCostText}`}
          contents={
            <div css={listContentsStyle}>
              <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                예상 경비
              </Text>
              <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                {plan.groupCostText}
              </Text>
            </div>
          }
          right={
            <Text typography="t7" fontWeight="bold" color="var(--adaptiveGrey800, #333d4b)" css={listRightTextStyle}>
              {plan.perPersonCostText}
            </Text>
          }
        />

        <BookingRiskSummary
          items={plan.bookingRisks}
          hasDetails={plan.timelineItems.length > 0}
          onClick={() => setSheet("details")}
        />

        <ListRow
          border="indented"
          verticalPadding="medium"
          horizontalPadding="small"
          withTouchEffect={canChangeOpinion}
          arrowType={canChangeOpinion ? "right" : undefined}
          onClick={canChangeOpinion ? () => setIsOpinionSheetOpen(true) : undefined}
          aria-label={`참여자 의견, ${opinionSummary}. ${myOpinionSummary}`}
          contents={
            <div css={listContentsStyle} aria-live="polite">
              <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                참여자 의견
              </Text>
              <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                {myOpinionSummary}
              </Text>
            </div>
          }
          right={
            <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)" css={listRightTextStyle}>
              {opinionSummary}
            </Text>
          }
        />
      </List>

      {!isRoomConfirmed && (
        <>
          <ListHeader
            size="small"
            title={<ListHeader.TitleParagraph>다른 행동</ListHeader.TitleParagraph>}
          />
          <List aria-label="여행안 보조 작업" css={secondaryListStyle}>
            <ListRow
              border="none"
              verticalPadding="medium"
              horizontalPadding="small"
              withTouchEffect
              arrowType="right"
              onClick={() => navigate(`/trips/${tripId}/plans/new?cloneFrom=${plan.id}`)}
              contents={
                <div css={listContentsStyle}>
                  <Text typography="t6" color="var(--adaptiveGrey800, #333d4b)">
                    다른 구성으로 제안하기
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                    이 여행안을 복제해 새 대안을 만들어요.
                  </Text>
                </div>
              }
            />
          </List>
        </>
      )}

      {isConfirmed ? (
        <FixedBottomCTA
          containerStyle={fixedCtaContainerStyle}
          onClick={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
        >
          확정 일정 보기
        </FixedBottomCTA>
      ) : isRoomConfirmed ? null : (
        <FixedBottomCTA
          containerStyle={fixedCtaContainerStyle}
          disabled={submitOpinionMutation.isPending}
          onClick={() => setIsOpinionSheetOpen(true)}
        >
          {plan.myReaction ? "내 의견 수정하기" : "내 의견 남기기"}
        </FixedBottomCTA>
      )}

      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        header={
          <BottomSheet.Header>
            {sheet === "actions" ? "여행안 관리" : sheet === "cost" ? "예상 경비" : "숙소·교통 상세"}
          </BottomSheet.Header>
        }
        headerDescription={
          sheet === "actions" ? (
            <BottomSheet.HeaderDescription>작성자만 여행안을 관리할 수 있어요.</BottomSheet.HeaderDescription>
          ) : sheet === "cost" ? (
            <BottomSheet.HeaderDescription>여행안에 기록한 예상 비용 스냅샷이에요.</BottomSheet.HeaderDescription>
          ) : (
            <BottomSheet.HeaderDescription>숙소·교통 예약 정보와 확인 상태를 살펴보세요.</BottomSheet.HeaderDescription>
          )
        }
        cta={<BottomSheet.CTA onClick={() => setSheet(null)}>닫기</BottomSheet.CTA>}
        maxHeight={sheet === "details" ? "84vh" : "60vh"}
        expandedMaxHeight={sheet === "details" ? "94vh" : "80vh"}
        expandBottomSheet={sheet === "details"}
      >
        {sheet === "actions" ? (
          <List aria-label="여행안 관리" css={sheetListStyle}>
            <ListRow
              border="none"
              verticalPadding="medium"
              horizontalPadding="small"
              withTouchEffect
              arrowType="right"
              onClick={() => {
                setSheet(null);
                navigate(`/trips/${tripId}/plans/${plan.id}/edit`);
              }}
              contents={
                <div css={listContentsStyle}>
                  <Text typography="t6" fontWeight="bold">여행안 수정</Text>
                  <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">작성한 내용을 고쳐요.</Text>
                </div>
              }
            />
            <ListRow
              border="none"
              verticalPadding="medium"
              horizontalPadding="small"
              withTouchEffect
              onClick={() => {
                setSheet(null);
                void handleDeletePlan();
              }}
              aria-label="여행안 삭제"
              contents={
                <div css={listContentsStyle}>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveRed600, #e0383e)">여행안 삭제</Text>
                  <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">삭제 전 한 번 더 확인해요.</Text>
                </div>
              }
            />
          </List>
        ) : sheet === "cost" ? (
          <List aria-label="예상 경비 상세" css={sheetListStyle}>
            <ListRow
              border="none"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={<Text typography="t6">그룹 총액</Text>}
              right={<Text typography="t6" fontWeight="bold">{plan.groupCostText}</Text>}
            />
            <ListRow
              border="none"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={<Text typography="t6">1인 예상 참고액</Text>}
              right={<Text typography="t6" fontWeight="bold">{plan.perPersonCostText}</Text>}
            />
          </List>
        ) : (
          <DetailTimeline items={plan.timelineItems} />
        )}
      </BottomSheet>

      <OpinionBottomSheet
        isOpen={isOpinionSheetOpen}
        onClose={() => setIsOpinionSheetOpen(false)}
        initialReaction={plan.myReaction as ReactionType | undefined}
        initialReason={plan.myOpinionReason ?? ""}
        isSubmitting={submitOpinionMutation.isPending}
        onSubmit={handleOpinionSubmit}
      />
    </div>
  );
}
