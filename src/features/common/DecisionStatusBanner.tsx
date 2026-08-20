import { css } from "@emotion/react";
import { Badge, List, ListRow, Text } from "@toss/tds-mobile";

interface DecisionStatusBannerProps {
  readonly statusText: string;
  readonly subText?: string;
  readonly isConfirmed?: boolean;
}

const statusListStyle = css`
  margin-bottom: 16px;
`;

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export function DecisionStatusBanner({
  statusText,
  subText,
  isConfirmed = false,
}: DecisionStatusBannerProps) {
  return (
    <List aria-label="여행방 결정 상태" css={statusListStyle}>
      <ListRow
        border="none"
        verticalPadding="small"
        horizontalPadding="small"
        left={
          <Badge size="small" variant="weak" color={isConfirmed ? "green" : "blue"}>
            {isConfirmed ? "확정됨" : "의견 수집 중"}
          </Badge>
        }
        contents={
          <div css={contentsStyle} aria-live="polite">
            <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
              {statusText}
            </Text>
            {subText && (
              <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                {subText}
              </Text>
            )}
          </div>
        }
      />
    </List>
  );
}
