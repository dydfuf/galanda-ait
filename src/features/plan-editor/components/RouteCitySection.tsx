import { css } from "@emotion/react";
import { getStayNightCount, type CityStay } from "../../../core/domain/room.ts";
import { RouteRail } from "../../common/RouteRail.tsx";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

const cardStyle = css`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background-color: var(--surface-content);
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (min-width: 390px) {
    padding: 20px;
  }
`;

const sectionHeaderStyle = css`
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
`;

const sectionTitleStyle = css`
  min-width: 0;
  margin: 0;
  color: var(--foreground);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
`;

const nightsStatusBadgeStyle = (isMatch: boolean) => css`
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  background-color: ${isMatch
    ? "var(--info-muted)"
    : "var(--destructive-muted)"};
  color: ${isMatch ? "var(--info)" : "var(--destructive-strong)"};
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  text-align: left;
  overflow-wrap: anywhere;
`;

const previewBoxStyle = css`
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-subtle);
`;

const previewLabelStyle = css`
  display: block;
  margin-bottom: 8px;
  color: var(--foreground-muted);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
`;

const cityListStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const cityRowStyle = css`
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-subtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const cityRowHeaderStyle = css`
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const cityIndexStyle = css`
  min-width: 0;
  margin: 0;
  color: var(--foreground-muted);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
`;

const inputStyle = css`
  width: 100%;
  min-width: 0;
  min-height: var(--touch-target-min);
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  outline: none;
  background-color: var(--surface-content);
  color: var(--foreground);
  font-size: 16px;
  line-height: 1.5;
  transition: border-color var(--motion-duration-fast)
    var(--motion-ease-standard);

  &:focus-visible {
    border-color: var(--primary);
  }
`;

const dateGridStyle = css`
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;

  @media (min-width: 390px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const fieldStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    color: var(--foreground-muted);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
  }
`;

const deleteCityBtnStyle = css`
  width: var(--touch-target-min);
  height: var(--touch-target-min);
  flex: 0 0 var(--touch-target-min);
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--foreground-muted);
  font-size: 16px;
  cursor: pointer;
  transition:
    color var(--motion-duration-fast) var(--motion-ease-standard),
    background-color var(--motion-duration-fast) var(--motion-ease-standard);

  &:hover {
    background-color: var(--destructive-muted);
    color: var(--destructive);
  }
`;

const addCityButtonStyle = css`
  width: 100%;
  min-height: var(--touch-target-min);
  padding: 10px 14px;
  border: 1px dashed var(--primary-border);
  border-radius: 10px;
  background-color: var(--info-muted);
  color: var(--info);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color var(--motion-duration-fast)
    var(--motion-ease-standard);

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
    <section css={cardStyle} data-galanda-surface="content">
      <div css={sectionHeaderStyle}>
        <h2 css={sectionTitleStyle}>
          {PLAN_EDITOR_SECTION_PRESENTATION.route.sectionHeading}
        </h2>
        <span css={nightsStatusBadgeStyle(isNightMatched)}>
          {routes.length === 0
            ? "도시 입력 필요"
            : isNightMatched
              ? `총 ${totalTripNights}박 배분 완료`
              : `${currentTotalNights}박 / ${totalTripNights}박 (${totalTripNights - currentTotalNights > 0 ? `${totalTripNights - currentTotalNights}박 부족` : `${currentTotalNights - totalTripNights}박 초과`})`}
        </span>
      </div>

      <div css={previewBoxStyle}>
        <span css={previewLabelStyle}>경로 미리보기</span>
        <RouteRail
          route={routes.map((stay) => ({
            city: stay.city,
            nights: Math.max(0, getStayNightCount(stay)),
          }))}
          differenceSummary={differenceSummary}
        />
      </div>

      <div css={cityListStyle}>
        {routes.map((stay, idx) => (
          <div key={idx} css={cityRowStyle}>
            <div css={cityRowHeaderStyle}>
              <h3 css={cityIndexStyle}>도시 {idx + 1}</h3>
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
            <div css={fieldStyle}>
              <label htmlFor={`route-${idx}-city`}>도시 이름</label>
              <input
                id={`route-${idx}-city`}
                type="text"
                placeholder={`도시 ${idx + 1} 이름`}
                value={stay.city}
                onChange={(e) => onUpdateCity(idx, { city: e.target.value })}
                css={inputStyle}
              />
            </div>
            <div css={dateGridStyle}>
              <div css={fieldStyle}>
                <label htmlFor={`route-${idx}-arrival`}>도착일</label>
                <input
                  id={`route-${idx}-arrival`}
                  type="date"
                  value={stay.arrivalDate}
                  onChange={(e) =>
                    onUpdateCity(idx, { arrivalDate: e.target.value })
                  }
                  css={inputStyle}
                />
              </div>
              <div css={fieldStyle}>
                <label htmlFor={`route-${idx}-departure`}>출발일</label>
                <input
                  id={`route-${idx}-departure`}
                  type="date"
                  value={stay.departureDate}
                  onChange={(e) =>
                    onUpdateCity(idx, { departureDate: e.target.value })
                  }
                  css={inputStyle}
                />
              </div>
            </div>
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
