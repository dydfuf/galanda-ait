import { GalandaIcon, type GalandaIconSize } from "./galanda-icon.tsx";

export type ActionIconName = "create-trip" | "companions" | "invite" | "complete";
interface ActionIconProps {
  readonly name: ActionIconName;
  readonly size?: GalandaIconSize;
  readonly className?: string;
}

/** Compatibility API. Completion semantics remain owned by the caller. */
export function ActionIcon(props: ActionIconProps) {
  return <GalandaIcon {...props} data-slot="action-icon" />;
}
