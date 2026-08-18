import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { RouteRail } from "../common/RouteRail.tsx";

const pageContainerStyle = css`
  padding: 16px 20px calc(64px + env(safe-area-inset-bottom, 0px));
  max-width: 640px;
  margin: 0 auto;
  min-height: 100vh;
  box-sizing: border-box;
`;

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 15px;
`;

const emptyContainerStyle = css`
  padding: 48px 20px;
  text-align: center;
  background-color: var(--adaptiveBackground, #ffffff);
  margin: 20px;
  border-radius: 16px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
`;

const emptyIconStyle = css`
  font-size: 36px;
  margin-bottom: 12px;
`;

const emptyTitleStyle = css`
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const emptyDescStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

const headerCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  border: 2px solid var(--adaptiveGreen500, #2da44e);
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const headerTopStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const confirmedBadgeStyle = css`
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  background-color: var(--adaptiveGreen50, #f0fbf4);
  color: var(--adaptiveGreen700, #15803d);
`;

const destinationTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const planTitleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const periodTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0;
`;

// IT-01 시안 2 핵심 1: 확인할 내용 주황색 배너
const needCheckBannerStyle = css`
  background-color: var(--adaptiveYellow50, #fff8e1);
  border: 1px solid #ffe082;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 24px;
`;

const needCheckHeaderStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--adaptiveYellow700, #b78103);
  margin-bottom: 8px;
`;

const needCheckListStyle = css`
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  color: var(--adaptiveGrey800, #333d4b);
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.4;
`;

// IT-01 시안 2 핵심 2: 세로 여정 타임라인 레일
const timelineContainerStyle = css`
  position: relative;
  margin-bottom: 28px;
  padding-left: 12px;

  &::before {
    content: "";
    position: absolute;
    top: 14px;
    bottom: 20px;
    left: 17px;
    width: 2px;
    background-color: var(--adaptiveGrey200, #e5e8eb);
    z-index: 1;
  }
`;

const daySectionStyle = css`
  position: relative;
  margin-bottom: 24px;
  padding-left: 28px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const dayDotStyle = css`
  position: absolute;
  top: 4px;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--adaptiveBlue500, #3182f6);
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 2px var(--adaptiveBlue200, #b8d7ff);
  z-index: 2;
`;

const dayHeaderStyle = css`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
`;

const dayNumberStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--adaptiveBlue600, #1b64da);
`;

const dayCityStyle = css`
  font-size: 14px;
  font-weight: 600;
  color: var(--adaptiveGrey800, #333d4b);
`;

const dayContentBoxStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const itemHeaderRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const itemTypeBadgeStyle = (bg: string, color: string) => css`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${bg};
  color: ${color};
`;

const itemTitleStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const itemDescStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey700, #4e5968);
  margin: 0;
`;

const itemLinkStyle = css`
  font-size: 12px;
  color: var(--adaptiveBlue500, #3182f6);
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  align-self: flex-start;

  &:hover {
    text-decoration: underline;
  }
`;

const bottomActionStyle = css`
  margin-top: 24px;
  text-align: center;
`;

export function ItineraryPage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError, error } = useTripRoomDetailQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return <div css={loadingContainerStyle}>확정 일정을 불러오는 중...</div>;
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="일정 정보를 찾을 수 없습니다"
        message={error instanceof Error ? error.message : "요청한 정보를 찾을 수 없습니다."}
      />
    );
  }

  const confirmedPlan = room.plans.find((p) => p.id === room.confirmedPlanId);

  if (!confirmedPlan) {
    return (
      <div css={emptyContainerStyle}>
        <div css={emptyIconStyle}>📅</div>
        <h2 css={emptyTitleStyle}>아직 확정된 일정이 없습니다</h2>
        <p css={emptyDescStyle}>
          팀원들과 제안된 후보 여행안을 검토하고<br />
          마음에 드는 계획을 확정해보세요.
        </p>
        <Button
          size="medium"
          type="button"
          onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        >
          후보 여행안 보러가기
        </Button>
      </div>
    );
  }

  // 확인할 내용 (Need-Check 요약)
  const needCheckRisks = confirmedPlan.bookingRisks || [];

  return (
    <div css={pageContainerStyle}>
      {/* 상단 확정 요약 배너 */}
      <header css={headerCardStyle}>
        <div css={headerTopStyle}>
          <span css={confirmedBadgeStyle}>✓ 최종 확정된 공동 일정</span>
          <span css={destinationTextStyle}>📍 {room.destination}</span>
        </div>

        <h1 css={planTitleStyle}>{confirmedPlan.title}</h1>

        <p css={periodTextStyle}>
          {room.period} · {confirmedPlan.nights}박 {confirmedPlan.days}일
        </p>

        <RouteRail route={confirmedPlan.route} />
      </header>

      {/* IT-01 시안 2 핵심 1: 확인할 내용 주황색 배너 */}
      {needCheckRisks.length > 0 ? (
        <div css={needCheckBannerStyle}>
          <div css={needCheckHeaderStyle}>
            <span>⚠️</span>
            <span>확인할 내용 ({needCheckRisks.length}건)</span>
          </div>
          <ul css={needCheckListStyle}>
            {needCheckRisks.map((risk, idx) => (
              <li key={idx}>
                <strong>{risk.message}</strong> ({risk.snapshotInfo})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          css={css`
            background-color: var(--adaptiveGreen50, #f0fbf4);
            border: 1px solid #bbf7d0;
            border-radius: 14px;
            padding: 14px 16px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--adaptiveGreen700, #15803d);
            font-weight: 600;
          `}
        >
          <span>✓</span>
          <span>모든 숙소와 교통 예약 확인이 완료된 일정입니다.</span>
        </div>
      )}

      {/* IT-01 시안 2 핵심 2: 세로 여정 타임라인 레일 */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--adaptiveGrey900, #191f28)" }}>
          날짜별 상세 일정
        </h2>

        <div css={timelineContainerStyle}>
          {confirmedPlan.timelineItems.map((item, idx) => {
            const dayNum = idx + 1;

            if (item.type === "STAY" && item.stay) {
              const stay = item.stay;
              const isNeedCheck = stay.bookingStatus === "NEED_CHECK" || stay.bookingStatus === "FULL";

              return (
                <div key={stay.id || idx} css={daySectionStyle}>
                  <div css={dayDotStyle} />
                  <div css={dayHeaderStyle}>
                    <span css={dayNumberStyle}>Day {dayNum}</span>
                    <span css={dayCityStyle}>📍 {stay.city} ({stay.nights}박)</span>
                  </div>

                  <div css={dayContentBoxStyle}>
                    <div css={itemHeaderRowStyle}>
                      <span css={itemTypeBadgeStyle("var(--adaptiveBlue50, #e8f3ff)", "var(--adaptiveBlue700, #1b64da)")}>
                        숙소
                      </span>
                      <span
                        css={itemTypeBadgeStyle(
                          isNeedCheck ? "var(--adaptiveYellow50, #fff8e1)" : "var(--adaptiveGreen50, #f0fbf4)",
                          isNeedCheck ? "var(--adaptiveYellow700, #b78103)" : "var(--adaptiveGreen700, #15803d)"
                        )}
                      >
                        {stay.bookingStatus === "AVAILABLE" && "예약 완료/가능"}
                        {stay.bookingStatus === "NEED_CHECK" && "확인 필요"}
                        {stay.bookingStatus === "FULL" && "만실"}
                        {stay.bookingStatus === "SEARCHING" && "탐색 중"}
                      </span>
                    </div>

                    <h4 css={itemTitleStyle}>{stay.hotelName}</h4>
                    <p css={itemDescStyle}>{stay.priceText} · {stay.confirmedInfo}</p>

                    {stay.bookingUrl && (
                      <a href={stay.bookingUrl} target="_blank" rel="noreferrer" css={itemLinkStyle}>
                        숙소 예약 상세 보기 ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            }

            if (item.type === "TRANSPORT" && item.transport) {
              const transport = item.transport;

              return (
                <div key={transport.id || idx} css={daySectionStyle}>
                  <div css={dayDotStyle} />
                  <div css={dayHeaderStyle}>
                    <span css={dayNumberStyle}>이동</span>
                    <span css={dayCityStyle}>{transport.fromCity} → {transport.toCity}</span>
                  </div>

                  <div css={dayContentBoxStyle}>
                    <div css={itemHeaderRowStyle}>
                      <span css={itemTypeBadgeStyle("var(--adaptiveGrey100, #f2f4f6)", "var(--adaptiveGrey700, #4e5968)")}>
                        교통편
                      </span>
                      <span css={itemTypeBadgeStyle("var(--adaptiveGreen50, #f0fbf4)", "var(--adaptiveGreen700, #15803d)")}>
                        {transport.bookingStatus === "AVAILABLE" ? "예매 가능" : "확인 필요"}
                      </span>
                    </div>

                    <h4 css={itemTitleStyle}>{transport.mode} ({transport.durationText})</h4>
                    <p css={itemDescStyle}>
                      {transport.hasTransfer ? "환승 필요" : "직통"} · {transport.priceText} · {transport.confirmedInfo}
                    </p>

                    {transport.bookingUrl && (
                      <a href={transport.bookingUrl} target="_blank" rel="noreferrer" css={itemLinkStyle}>
                        교통편 예매 정보 보기 ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </section>

      {/* 하단 보조 액션: 검토 기록 보기 */}
      <div css={bottomActionStyle}>
        <Button
          display="block"
          size="medium"
          type="button"
          onClick={() => navigate(`/trips/${tripId}/plans`)}
        >
          검토했던 여행안 기록 보기
        </Button>
      </div>
    </div>
  );
}
