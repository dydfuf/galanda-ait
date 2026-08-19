import { useState, useRef, useEffect } from "react";
import { css } from "@emotion/react";
import { FixedBottomCTA, TopNavigation, TopNavigationBackButton } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { useCreateTripRoomMutation } from "./mutations.ts";
import { fixedCtaContainerStyle } from "../common/tds-layout.ts";

const screenStyle = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100vh;
  min-height: 100dvh;
`;

const pageContainerStyle = css`
  padding: 8px 20px 24px;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const pageHeaderStyle = css`
  margin-bottom: 32px;
`;

const pageTitleStyle = css`
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--adaptiveGrey900, #191f28);
  letter-spacing: -0.5px;
  line-height: 1.35;
`;

const pageSubtitleStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0;
  line-height: 1.5;
`;

const formStyle = css`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const inputCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const fieldLabelStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--adaptiveGrey700, #4e5968);
`;

const countStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey400, #b0b8c1);
`;

const countWarningStyle = css`
  font-size: 12px;
  color: var(--adaptiveRed500, #f04452);
  font-weight: 600;
`;

const textInputStyle = css`
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--adaptiveGrey50, #f9fafb);
  color: var(--adaptiveGrey900, #191f28);
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:focus {
    background-color: var(--adaptiveBackground, #ffffff);
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const helperTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 4px 0 0 0;
`;

const errorMessageStyle = css`
  font-size: 13px;
  color: var(--adaptiveRed600, #e0383e);
  margin-top: 12px;
  text-align: center;
`;

const MAX_TITLE_LENGTH = 30;

export function TripCreatePage() {
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const createRoomMutation = useCreateTripRoomMutation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedTitle = title.trim();
  const isValid = trimmedTitle.length >= 1 && trimmedTitle.length <= MAX_TITLE_LENGTH;
  const isCloseToLimit = title.length >= 25;

  const handleSubmit = async () => {
    if (!isValid || createRoomMutation.isPending) return;

    setErrorMsg(null);
    try {
      const newRoom = await createRoomMutation.mutateAsync({
        title: trimmedTitle,
      });

      // 생성 성공 시 여행방 계획 탭 홈으로 이동 (기획서 TR-02 명세)
      navigate(`/trips/${newRoom.id}/plans`, { replace: true });
    } catch {
      setErrorMsg("여행을 만들지 못했어요. 다시 시도해주세요.");
    }
  };

  return (
    <div css={screenStyle}>
      <TopNavigation leading={<TopNavigationBackButton aria-label="뒤로 가기" onClick={goBack} />} />

      <div css={pageContainerStyle}>
        <header css={pageHeaderStyle}>
          <h1 css={pageTitleStyle}>
            어떤 여행을 계획하고 있나요?
          </h1>
          <p css={pageSubtitleStyle}>
            먼저 여행 이름만 정해주세요. 날짜와 도시는 여행안을 만들며 함께 정할 수 있어요.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          css={formStyle}
        >
          <div css={inputCardStyle}>
            <label css={fieldLabelStyle} htmlFor="trip-title">
              <span>여행 이름 *</span>
              {isCloseToLimit && (
                <span css={title.length > MAX_TITLE_LENGTH ? countWarningStyle : countStyle}>
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              )}
            </label>

            <input
              id="trip-title"
              ref={inputRef}
              type="text"
              placeholder="예: 일본 여행, 2026 제주 힐링"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              css={textInputStyle}
              aria-describedby="trip-title-help"
              required
            />

            <p css={helperTextStyle} id="trip-title-help">
              <span aria-hidden="true">💡 </span>
              여행방을 만든 후 첫 번째 여행안을 제안할 수 있어요.
            </p>
          </div>

          {errorMsg && (
            <p css={errorMessageStyle} role="alert">
              {errorMsg}
            </p>
          )}
        </form>
      </div>

      {/* 화면 하단 고정 CTA: 입력 중 키보드가 올라와도 가려지지 않아요. */}
      <FixedBottomCTA
        containerStyle={fixedCtaContainerStyle}
        disabled={!isValid || createRoomMutation.isPending}
        onClick={() => void handleSubmit()}
      >
        {createRoomMutation.isPending ? "여행방 만드는 중..." : "여행 만들기"}
      </FixedBottomCTA>
    </div>
  );
}
