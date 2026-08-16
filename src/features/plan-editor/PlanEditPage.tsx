import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { RouteRail } from "../common/RouteRail.tsx";

const loadingContainerStyle = css`
  padding: 24px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 15px;
`;

const pageContainerStyle = css`
  padding: 16px 20px calc(40px + env(safe-area-inset-bottom, 0px));
`;

const pageHeaderStyle = css`
  margin-bottom: 20px;
`;

const pageTitleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const pageSubtitleStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const formCardStyle = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--adaptiveBackground, #ffffff);
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
`;

const fieldLabelStyle = css`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--adaptiveGrey800, #333d4b);
  margin-bottom: 8px;
`;

const inputStyle = css`
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const submitWrapperStyle = css`
  margin-top: 12px;
`;

export function PlanEditPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const { data: room, isLoading, isError } = useTripRoomDetailQuery(tripId);
  const plan = room?.plans.find((p) => p.id === planId);

  useEffect(() => {
    if (plan) {
      setTitle(plan.title);
    }
  }, [plan]);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행안 경로입니다." />;
  }

  if (isLoading) {
    return (
      <div css={loadingContainerStyle}>
        <p css={loadingTextStyle}>데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (isError || !room || !plan) {
    return (
      <RouteErrorFallback
        title="수정할 여행안을 찾을 수 없습니다"
        message="요청하신 정보가 없거나 삭제되었습니다."
      />
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    // 스캐폴딩: 수정 완료 후 상세 페이지로 이동 (문서 10절)
    setTimeout(() => {
      setIsSubmitting(false);
      navigate(`/trips/${tripId}/plans/${planId}`, { replace: true });
    }, 500);
  };

  return (
    <div css={pageContainerStyle}>
      <header css={pageHeaderStyle}>
        <h1 css={pageTitleStyle}>
          여행안 수정하기
        </h1>
        <p css={pageSubtitleStyle}>
          내가 제안한 여행안의 내용을 변경합니다.
        </p>
      </header>

      <form onSubmit={handleSubmit} css={formCardStyle}>
        <div>
          <label css={fieldLabelStyle}>
            여행안 제목 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            css={inputStyle}
            required
          />
        </div>

        <div>
          <label css={fieldLabelStyle}>
            경로 코스
          </label>
          <RouteRail route={plan.route} differenceSummary={plan.differenceSummary} />
        </div>

        <div css={submitWrapperStyle}>
          <Button
            display="block"
            size="large"
            type="submit"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? "저장 중..." : "수정 완료"}
          </Button>
        </div>
      </form>
    </div>
  );
}
