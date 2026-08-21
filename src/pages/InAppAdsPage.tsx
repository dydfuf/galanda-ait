import { css } from "@emotion/react";
import { useInAppAds } from "@/platform/ait/useInAppAds.tsx";
import { useAppNavigation } from "../hooks/useAppNavigation.ts";

// TODO: 서비스를 출시하기 전에 앱인토스 콘솔에서 발급한 광고 그룹 ID로 변경해 주세요.
const TEST_INTERSTITIAL_ID = "ait-ad-test-interstitial-id";
const TEST_REWARDED_ID = "ait-ad-test-rewarded-id";

interface InAppAdsPageProps {
  onBack?: () => void;
}

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
  color: var(--secondary-foreground);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &:active {
    opacity: 0.7;
    background-color: var(--muted);
  }
`;

const headerStyle = css`
  margin-bottom: 24px;
`;

const titleStyle = css`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--foreground);
`;

const subtitleStyle = css`
  font-size: 13px;
  color: #8b95a1;
  margin: 0;
`;

const sectionListStyle = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const sectionCardStyle = css`
  background-color: var(--background);
  border-radius: 16px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const sectionRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const sectionInfoStyle = css`
  flex: 1;
`;

const sectionTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0 0 4px 0;
`;

const sectionDescStyle = css`
  font-size: 13px;
  color: #8b95a1;
  margin: 0;
`;

const actionButtonStyle = css`
  padding: 8px 16px;
  border-radius: 8px;
  background-color: var(--info-muted);
  color: var(--info);
  font-size: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled) {
    background-color: #dbeafe;
  }

  &:active:not(:disabled) {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const rewardMessageStyle = css`
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  margin: 4px 0 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--muted);
`;

export function InAppAdsPage({ onBack }: InAppAdsPageProps) {
  const { goBack } = useAppNavigation();
  const interstitial = useInAppAds(TEST_INTERSTITIAL_ID);
  const rewarded = useInAppAds(TEST_REWARDED_ID);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  };

  return (
    <div css={pageContainerStyle}>
      <div css={backRowStyle}>
        <button
          type="button"
          onClick={handleBack}
          css={backButtonStyle}
        >
          ← 뒤로가기
        </button>
      </div>

      <header css={headerStyle}>
        <h1 css={titleStyle}>인앱 광고</h1>
        {!interstitial.isSupported && (
          <p css={subtitleStyle}>
            이 환경에서는 인앱 광고를 사용할 수 없어요.
          </p>
        )}
      </header>

      <div css={sectionListStyle}>
        <div css={sectionCardStyle}>
          <div css={sectionRowStyle}>
            <div css={sectionInfoStyle}>
              <h2 css={sectionTitleStyle}>전면형 광고</h2>
              <p css={sectionDescStyle}>화면 전체에 표시되는 광고</p>
            </div>
            <button
              type="button"
              css={actionButtonStyle}
              onClick={interstitial.showAd}
              disabled={!interstitial.isAdLoaded}
            >
              {interstitial.isAdLoaded ? "보기" : "로딩 중"}
            </button>
          </div>
        </div>

        <div css={sectionCardStyle}>
          <div css={sectionRowStyle}>
            <div css={sectionInfoStyle}>
              <h2 css={sectionTitleStyle}>보상형 광고</h2>
              <p css={sectionDescStyle}>시청 완료 시 보상을 받는 광고</p>
            </div>
            <button
              type="button"
              css={actionButtonStyle}
              onClick={rewarded.showAd}
              disabled={!rewarded.isAdLoaded}
            >
              {rewarded.isAdLoaded ? "보기" : "로딩 중"}
            </button>
          </div>

          {rewarded.lastReward && (
            <p css={rewardMessageStyle}>
              보상 획득: {rewarded.lastReward.unitType}{" "}
              {rewarded.lastReward.unitAmount}개
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
