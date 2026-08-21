import { Badge } from "@/components/ui/badge.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { MobileListItem } from "@/components/galanda/mobile-list.tsx";

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

const getRiskState = (
  items: ReadonlyArray<BookingRiskItem>,
  hasDetails: boolean
): { label: string; description: string; variant: "success" | "danger" | "warning" } => {
  if (!hasDetails) {
    return {
      label: "미등록",
      description: "숙소·교통 정보가 아직 등록되지 않았어요",
      variant: "warning",
    };
  }

  if (items.length === 0) {
    return {
      label: "확인됨",
      description: "모든 예약 정보를 확인했어요",
      variant: "success",
    };
  }

  const hasDanger = items.some((item) => item.level === "DANGER");
  return {
    label: `${items.length}개`,
    description: `확인이 필요한 항목 ${items.length}개`,
    variant: hasDanger ? "danger" : "warning",
  };
};

export function BookingRiskSummary({ items, hasDetails, onClick }: BookingRiskSummaryProps) {
  const state = getRiskState(items, hasDetails);

  return (
    <MobileListItem
      chevron
      className="px-2"
      onClick={onClick}
      aria-label={`숙소·교통, ${state.description}`}
      trailing={<Badge variant={state.variant}>{state.label}</Badge>}
    >
      <ItemTitle>숙소·교통</ItemTitle>
      <ItemDescription>{state.description}</ItemDescription>
    </MobileListItem>
  );
}
