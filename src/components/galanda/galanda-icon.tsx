import { createElement } from "react";
import { cn } from "@/lib/utils";
import { ICON_NODES } from "./icons/icon-nodes.ts";

export type GalandaIconName = keyof typeof ICON_NODES;
export type GalandaIconSize = 16 | 20 | 24;
export type GalandaIconSelection = {
  [Name in GalandaIconName]: {
    readonly name: Name;
    readonly variant?: keyof (typeof ICON_NODES)[Name];
  };
}[GalandaIconName];
export type GalandaIconProps = GalandaIconSelection & {
  readonly size?: GalandaIconSize;
  readonly className?: string;
  /** Compatibility wrappers retain their existing test/inspection slot. */
  readonly "data-slot"?: string;
};

type Geometry = {
  readonly attrs: Readonly<Record<string, string>>;
  readonly nodes: ReadonlyArray<{
    readonly tag: string;
    readonly attrs: Readonly<Record<string, string>>;
  }>;
};
const registry: Readonly<Record<GalandaIconName, Readonly<Record<string, Geometry>>>> = ICON_NODES;
const sizes = { 16: "size-4", 20: "size-5", 24: "size-6" } as const;

/** Decorative only: the surrounding button/link/text owns the accessible name. */
export function GalandaIcon({ name, variant = "outline", size = 24, className, "data-slot": slot = "galanda-icon" }: GalandaIconProps) {
  const icon = registry[name]?.[variant];
  if (!icon) throw new Error(`Unknown Galanda icon: ${name}/${variant}`);
  return createElement(
    "svg",
    {
      ...icon.attrs,
      width: size,
      height: size,
      className: cn("shrink-0", sizes[size], className),
      "data-slot": slot,
      "data-icon": name,
      "data-variant": variant,
      "aria-hidden": true,
      focusable: "false",
    },
    icon.nodes.map(({ tag, attrs }, index) => createElement(tag, { ...attrs, key: index })),
  );
}
