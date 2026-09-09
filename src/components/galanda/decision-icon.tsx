import { GalandaIcon, type GalandaIconSize } from "./galanda-icon.tsx";

export type DecisionIconName = "compare" | "bookmark" | "import-plan" | "share";
type DecisionIconProps = {
  readonly size?: GalandaIconSize;
  readonly className?: string;
} & (
  | { readonly name: "bookmark"; readonly variant?: "outline" | "filled" }
  | { readonly name: Exclude<DecisionIconName, "bookmark">; readonly variant?: "outline" }
);

/** Compatibility API. Bookmark fill follows the caller's persisted/optimistic state. */
export function DecisionIcon(props: DecisionIconProps) {
  return <GalandaIcon {...props} data-slot="decision-icon" />;
}
