import { css } from "@emotion/react";
import { Badge, ListRow, Text } from "@toss/tds-mobile";

export interface BookingRiskItem {
  readonly level: "DANGER" | "WARNING" | "SUCCESS";
  readonly message: string;
  readonly snapshotInfo: string;
}

interface BookingRiskSummaryProps {
  readonly items: ReadonlyArray<BookingRiskItem>;
  readonly hasDetails: boolean;
  readonly onClick: () => void;
}

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const getRiskState = (
  items: ReadonlyArray<BookingRiskItem>,
  hasDetails: boolean
): { label: string; description: string; color: "green" | "red" | "yellow" } => {
  if (!hasDetails) {
    return {
      label: "미등록",
      description: "숙소·교통 정보가 아직 등록되지 않았어요",
      color: "yellow",
    };
  }

  if (items.length === 0) {
    return {
      label: "확인됨",
      description: "모든 예약 정보를 확인했어요",
      color: "green",
    };
  }

  const hasDanger = items.some((item) => item.level === "DANGER");
  return {
    label: `${items.length}개`,
    description: `확인이 필요한 항목 ${items.length}개`,
    color: hasDanger ? "red" : "yellow",
  };
};

export function BookingRiskSummary({ items, hasDetails, onClick }: BookingRiskSummaryProps) {
  const state = getRiskState(items, hasDetails);

  return (
    <ListRow
      border="indented"
      verticalPadding="medium"
      horizontalPadding="small"
      withTouchEffect
      arrowType="right"
      onClick={onClick}
      aria-label={`숙소·교통, ${state.description}`}
      contents={
        <div css={contentsStyle}>
          <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
            숙소·교통
          </Text>
          <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
            {state.description}
          </Text>
        </div>
      }
      right={
        <Badge size="small" variant="weak" color={state.color}>
          {state.label}
        </Badge>
      }
    />
  );
}
