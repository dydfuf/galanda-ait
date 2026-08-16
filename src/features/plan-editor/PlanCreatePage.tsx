import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";

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

const inputSmallStyle = css`
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const cityListStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const cityRowStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const cityIndexStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveGrey500, #8b95a1);
  width: 20px;
`;

const cityInputStyle = css`
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const addCityButtonStyle = css`
  padding: 10px 12px;
  border: 1px dashed var(--adaptiveGrey300, #d1d6db);
  background-color: var(--adaptiveGrey50, #f9fafb);
  border-radius: 8px;
  color: var(--adaptiveBlue500, #3182f6);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  margin-top: 4px;
  transition: background-color 0.15s ease, transform 0.12s ease;

  &:hover {
    background-color: var(--adaptiveGrey100, #f2f4f6);
  }

  &:active {
    transform: scale(0.99);
  }
`;

const submitWrapperStyle = css`
  margin-top: 8px;
`;

export function PlanCreatePage() {
  const params = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [cities, setCities] = useState<string[]>(["제주시", "서귀포시"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validated = decodeRouteParams(TripParamsSchema, params);
  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const { tripId } = validated.success;

  const handleAddCity = () => {
    setCities([...cities, ""]);
  };

  const handleCityChange = (index: number, val: string) => {
    const next = [...cities];
    next[index] = val;
    setCities(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    // 스캐폴딩: 생성 시뮬레이션 후 생성된 여행안 상세 페이지로 이동
    setTimeout(() => {
      setIsSubmitting(false);
      navigate(`/trips/${tripId}/plans`, { replace: true });
    }, 500);
  };

  return (
    <div css={pageContainerStyle}>
      <header css={pageHeaderStyle}>
        <h1 css={pageTitleStyle}>
          새 여행안 제안하기
        </h1>
        <p css={pageSubtitleStyle}>
          코스와 방문 도시를 제안하고 친구들과 함께 비교해보세요.
        </p>
      </header>

      <form onSubmit={handleSubmit} css={formCardStyle}>
        <div>
          <label css={fieldLabelStyle}>
            여행안 제목 *
          </label>
          <input
            type="text"
            placeholder="예: 힐링 카페 & 호캉스 코스"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            css={inputStyle}
            required
          />
        </div>

        <div>
          <label css={fieldLabelStyle}>
            제안 이유 (한 줄 요약)
          </label>
          <input
            type="text"
            placeholder="예: 이동 시간을 줄이고 여유롭게 호캉스를 즐기는 안입니다."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            css={inputSmallStyle}
          />
        </div>

        <div>
          <label css={fieldLabelStyle}>
            경유 도시 순서
          </label>
          <div css={cityListStyle}>
            {cities.map((city, idx) => (
              <div key={idx} css={cityRowStyle}>
                <span css={cityIndexStyle}>
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  placeholder={`도시 ${idx + 1} 이름`}
                  value={city}
                  onChange={(e) => handleCityChange(idx, e.target.value)}
                  css={cityInputStyle}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddCity}
              css={addCityButtonStyle}
            >
              + 도시 추가
            </button>
          </div>
        </div>

        <div css={submitWrapperStyle}>
          <Button
            display="block"
            size="large"
            type="submit"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? "작성 중..." : "여행안 제안 등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}
