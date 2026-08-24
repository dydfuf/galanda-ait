import { css } from "@emotion/react";
import { getStayNightCount, type CityStay } from "../../../core/domain/room.ts";
import { RouteRail } from "../../common/RouteRail.tsx";

const cardStyle = css`
  background-color: var(--background);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border);
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
  color: var(--foreground);
  margin: 0;
`;

const nightsStatusBadgeStyle = (isMatch: boolean) => css`
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: ${isMatch ? "var(--info-muted)" : "var(--destructive-muted)"};
  color: ${isMatch ? "var(--info)" : "var(--destructive-strong)"};
`;

const previewBoxStyle = css`
  background-color: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
`;

const previewLabelStyle = css`
  font-size: 11px;
  font-weight: 700;
  color: var(--foreground-subtle);
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
  background-color: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
`;

const cityIndexStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--foreground-subtle);
  min-width: 18px;
`;

const cityInputStyle = css`
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  font-size: 14px;
  outline: none;
  background-color: var(--background);
  color: var(--foreground);

  &:focus {
    border-color: var(--primary);
  }
`;

const deleteCityBtnStyle = css`
  background: none;
  border: none;
  color: var(--border-stronger);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;

  &:hover {
    color: var(--destructive);
  }
`;

const addCityButtonStyle = css`
  padding: 10px 14px;
  border: 1px dashed var(--primary-border);
  background-color: var(--info-muted);
  border-radius: 10px;
  color: var(--info);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--primary-muted);
  }
`;

interface RouteCitySectionProps {
  readonly routes: ReadonlyArray<CityStay>;
  readonly totalTripNights: number;
  readonly currentTotalNights: number;
  readonly differenceSummary?: string;
  readonly onAddCity: (city?: string) => void;
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
  const isNightMatched = routes.length > 0 && currentTotalNights === totalTripNights;

  return (
    <section css={cardStyle}>
      <div css={sectionHeaderStyle}>
        <h2 css={sectionTitleStyle}>날짜와 도시 체류 배분</h2>
        <span css={nightsStatusBadgeStyle(isNightMatched)}>
          {routes.length === 0
            ? "도시 입력 필요"
            : isNightMatched
            ? `총 ${totalTripNights}박 배분 완료`
            : `${currentTotalNights}박 / ${totalTripNights}박 (${totalTripNights - currentTotalNights > 0 ? `${totalTripNights - currentTotalNights}박 부족` : `${currentTotalNights - totalTripNights}박 초과`})`}
        </span>
      </div>

      {/* 실시간 압축 경로 레일 미리보기 */}
      <div css={previewBoxStyle}>
        <span css={previewLabelStyle}>경로 미리보기</span>
        <RouteRail route={routes.map((stay) => ({ city: stay.city, nights: Math.max(0, getStayNightCount(stay)) }))} differenceSummary={differenceSummary} />
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
            <input type="date" aria-label={`도시 ${idx + 1} 도착일`} value={stay.arrivalDate} onChange={(e) => onUpdateCity(idx, { arrivalDate: e.target.value })} />
            <input type="date" aria-label={`도시 ${idx + 1} 출발일`} value={stay.departureDate} onChange={(e) => onUpdateCity(idx, { departureDate: e.target.value })} />
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
          onClick={() => onAddCity("")}
          css={addCityButtonStyle}
        >
          {routes.length === 0 ? "+ 방문 도시 추가" : "+ 경유 도시 추가"}
        </button>
      </div>
    </section>
  );
}
