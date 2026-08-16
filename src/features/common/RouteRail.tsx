import { css } from "@emotion/react";

export interface RouteSegment {
  readonly city: string;
  readonly nights: number;
}

interface RouteRailProps {
  readonly route: ReadonlyArray<RouteSegment>;
  readonly differenceSummary?: string;
}

const containerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const railScrollStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 2px 4px 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const segmentWrapperStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const segmentBoxStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--adaptiveGrey100, #f2f4f6);
  padding: 6px 10px;
  border-radius: 8px;
  min-width: 54px;
`;

const cityStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveGrey800, #333d4b);
`;

const nightsStyle = css`
  font-size: 11px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin-top: 2px;
  font-weight: 500;
`;

const arrowStyle = css`
  color: var(--adaptiveGrey400, #b0b8c1);
  font-size: 12px;
  font-weight: 700;
`;

const differenceStyle = css`
  font-size: 12px;
  color: var(--adaptiveBlue500, #3182f6);
  font-weight: 600;
  margin: 2px 0 0 0;
`;

export function RouteRail({ route, differenceSummary }: RouteRailProps) {
  if (!route || route.length === 0) {
    return null;
  }

  return (
    <div css={containerStyle}>
      {/* 압축 경로 레일 */}
      <div css={railScrollStyle}>
        {route.map((segment, idx) => (
          <div key={idx} css={segmentWrapperStyle}>
            <div css={segmentBoxStyle}>
              <span css={cityStyle}>
                {segment.city}
              </span>
              <span css={nightsStyle}>
                {segment.nights > 0 ? `${segment.nights}박` : "당일"}
              </span>
            </div>

            {idx < route.length - 1 && (
              <span css={arrowStyle}>→</span>
            )}
          </div>
        ))}
      </div>

      {/* 원본과의 차이 요약 문구 (시각안 2 명세) */}
      {differenceSummary && (
        <p css={differenceStyle}>
          ⓘ {differenceSummary}
        </p>
      )}
    </div>
  );
}
