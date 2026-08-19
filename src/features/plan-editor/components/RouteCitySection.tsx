import { css } from "@emotion/react";
import type { CityStay } from "../../../core/domain/room.ts";
import { RouteRail } from "../../common/RouteRail.tsx";
import { visuallyHiddenStyle } from "../../common/a11y.ts";

const cardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const sectionHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const sectionTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const nightsStatusBadgeStyle = (isMatch: boolean) => css`
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: ${isMatch ? "var(--adaptiveBlue50, #e8f3ff)" : "var(--adaptiveRed50, #ffeeee)"};
  color: ${isMatch ? "var(--adaptiveBlue600, #1b64da)" : "var(--adaptiveRed600, #e11d48)"};
`;

const previewBoxStyle = css`
  background-color: var(--adaptiveGrey50, #f9fafb);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  border-radius: 12px;
  padding: 12px 14px;
`;

const previewLabelStyle = css`
  font-size: 11px;
  font-weight: 700;
  color: var(--adaptiveGrey500, #8b95a1);
  margin-bottom: 6px;
  display: block;
`;

const cityListStyle = css`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const cityRowStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--adaptiveGrey50, #f9fafb);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  border-radius: 10px;
  padding: 8px 12px;
`;

const cityIndexStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveGrey500, #8b95a1);
  min-width: 18px;
`;

const cityInputStyle = css`
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--adaptiveGrey300, #d1d6db);
  font-size: 14px;
  outline: none;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const nightControlsStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
`;

const nightBtnStyle = css`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--adaptiveGrey300, #d1d6db);
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey800, #333d4b);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const nightValueStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  min-width: 28px;
  text-align: center;
`;

const deleteCityBtnStyle = css`
  background: none;
  border: none;
  color: var(--adaptiveGrey400, #b0b8c1);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;

  &:hover {
    color: var(--adaptiveRed500, #f04452);
  }
`;

const addCityButtonStyle = css`
  padding: 10px 14px;
  border: 1px dashed var(--adaptiveBlue300, #82b6ff);
  background-color: var(--adaptiveBlue50, #f2f7ff);
  border-radius: 10px;
  color: var(--adaptiveBlue600, #1b64da);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--adaptiveBlue100, #e0edff);
  }
`;

interface RouteCitySectionProps {
  readonly routes: ReadonlyArray<CityStay>;
  readonly totalTripNights: number;
  readonly currentTotalNights: number;
  readonly differenceSummary?: string;
  readonly onAddCity: (city?: string, nights?: number) => void;
  readonly onUpdateCity: (index: number, updated: Partial<CityStay>) => void;
  readonly onRemoveCity: (index: number) => void;
}

export function RouteCitySection({
  routes,
  totalTripNights,
  currentTotalNights,
  differenceSummary,
  onAddCity,
  onUpdateCity,
  onRemoveCity,
}: RouteCitySectionProps) {
  const isNightMatched = currentTotalNights === totalTripNights;

  return (
    <section css={cardStyle}>
      <div css={sectionHeaderStyle}>
        <h2 css={sectionTitleStyle}>2. 날짜와 도시 체류 배분</h2>
        <span css={nightsStatusBadgeStyle(isNightMatched)}>
          {isNightMatched
            ? `총 ${totalTripNights}박 배분 완료`
            : `${currentTotalNights}박 / ${totalTripNights}박 (${totalTripNights - currentTotalNights > 0 ? `${totalTripNights - currentTotalNights}박 부족` : `${currentTotalNights - totalTripNights}박 초과`})`}
        </span>
      </div>

      {/* 실시간 압축 경로 레일 미리보기 */}
      <div css={previewBoxStyle}>
        <span css={previewLabelStyle}>경로 미리보기</span>
        <RouteRail route={routes} differenceSummary={differenceSummary} />
      </div>

      {/* 도시 목록 입력 및 박수 조절 */}
      <div css={cityListStyle}>
        {routes.map((stay, idx) => (
          <div key={idx} css={cityRowStyle}>
            <span css={cityIndexStyle} aria-hidden="true">
              {idx + 1}
            </span>
            <input
              type="text"
              aria-label={`도시 ${idx + 1} 이름`}
              placeholder={`도시 ${idx + 1} 이름`}
              value={stay.city}
              onChange={(e) => onUpdateCity(idx, { city: e.target.value })}
              css={cityInputStyle}
            />
            <fieldset css={nightControlsStyle}>
              <legend css={visuallyHiddenStyle}>{`도시 ${idx + 1} 체류 박수`}</legend>
              <button
                type="button"
                css={nightBtnStyle}
                aria-label={`도시 ${idx + 1} 체류 1박 줄이기`}
                disabled={stay.nights <= 1}
                onClick={() => onUpdateCity(idx, { nights: Math.max(1, stay.nights - 1) })}
              >
                <span aria-hidden="true">-</span>
              </button>
              <span css={nightValueStyle} aria-live="polite">
                {stay.nights}박
              </span>
              <button
                type="button"
                css={nightBtnStyle}
                aria-label={`도시 ${idx + 1} 체류 1박 늘리기`}
                disabled={stay.nights >= 30}
                onClick={() => onUpdateCity(idx, { nights: stay.nights + 1 })}
              >
                <span aria-hidden="true">+</span>
              </button>
            </fieldset>
            {routes.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveCity(idx)}
                css={deleteCityBtnStyle}
                aria-label={`도시 ${idx + 1} 삭제`}
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => onAddCity("", 1)}
          css={addCityButtonStyle}
        >
          + 경유 도시 추가
        </button>
      </div>
    </section>
  );
}
