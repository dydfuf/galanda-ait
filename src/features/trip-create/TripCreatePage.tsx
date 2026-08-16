import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";

const pageContainerStyle = css`
  padding: max(16px, env(safe-area-inset-top, 16px)) 20px calc(40px + env(safe-area-inset-bottom, 0px));
`;

const backRowStyle = css`
  margin-bottom: 12px;
`;

const backButtonStyle = css`
  background: none;
  border: none;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 15px;
  color: var(--adaptiveGrey800, #333d4b);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &:active {
    opacity: 0.7;
    background-color: var(--adaptiveGrey100, #f2f4f6);
  }
`;

const pageHeaderStyle = css`
  margin-bottom: 24px;
`;

const pageTitleStyle = css`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const pageSubtitleStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
  line-height: 1.4;
`;

const formCardStyle = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
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

const dateRowStyle = css`
  display: flex;
  gap: 12px;
`;

const dateColStyle = css`
  flex: 1;
`;

const dateInputStyle = css`
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

const submitWrapperStyle = css`
  margin-top: 8px;
`;

export function TripCreatePage() {
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !destination) return;

    setIsSubmitting(true);
    // 스캐폴딩: 생성 시뮬레이션 후 생성된 tripId로 replace 이동
    setTimeout(() => {
      setIsSubmitting(false);
      // Mock trip ID 생성 후 이동
      const newTripId = "room-1";
      navigate(`/trips/${newTripId}`, { replace: true });
    }, 500);
  };

  return (
    <div css={pageContainerStyle}>
      <div css={backRowStyle}>
        <button
          type="button"
          onClick={goBack}
          css={backButtonStyle}
        >
          ← 뒤로가기
        </button>
      </div>

      <header css={pageHeaderStyle}>
        <h1 css={pageTitleStyle}>
          새 여행방 만들기
        </h1>
        <p css={pageSubtitleStyle}>
          여행방을 생성하고 친구들을 초대하여 함께 일정을 조율하세요.
        </p>
      </header>

      <form onSubmit={handleSubmit} css={formCardStyle}>
        <div>
          <label css={fieldLabelStyle}>
            여행 이름 *
          </label>
          <input
            type="text"
            placeholder="예: 2026 제주 힐링 여행"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            css={inputStyle}
            required
          />
        </div>

        <div>
          <label css={fieldLabelStyle}>
            여행 목적지 *
          </label>
          <input
            type="text"
            placeholder="예: 제주도, 도쿄, 파리"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            css={inputStyle}
            required
          />
        </div>

        <div css={dateRowStyle}>
          <div css={dateColStyle}>
            <label css={fieldLabelStyle}>
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              css={dateInputStyle}
            />
          </div>
          <div css={dateColStyle}>
            <label css={fieldLabelStyle}>
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              css={dateInputStyle}
            />
          </div>
        </div>

        <div css={submitWrapperStyle}>
          <Button
            display="block"
            size="large"
            type="submit"
            disabled={isSubmitting || !title || !destination}
          >
            {isSubmitting ? "생성 중..." : "여행방 만들기"}
          </Button>
        </div>
      </form>
    </div>
  );
}
