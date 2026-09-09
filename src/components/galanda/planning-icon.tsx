import { GalandaIcon, type GalandaIconSize } from "./galanda-icon.tsx";

export type PlanningIconName = "calendar" | "route" | "stay" | "ticket";
interface PlanningIconProps {
  readonly name: PlanningIconName;
  readonly size?: GalandaIconSize;
  readonly className?: string;
}

/** Compatibility API. A ticket is an item, not booking confirmation. */
export function PlanningIcon(props: PlanningIconProps) {
  return <GalandaIcon {...props} data-slot="planning-icon" />;
}
