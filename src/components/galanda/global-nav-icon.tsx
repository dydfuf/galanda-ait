import type { ReactNode } from "react";

import type { GlobalNavKey } from "@/app/routes/global-nav.ts";

interface GlobalNavIconProps {
  readonly navKey: GlobalNavKey;
  readonly active: boolean;
}

const COMPASS_NEEDLE_PATH =
  "M16.6 6.8c.4-.18.78.2.6.6l-2.75 6.2c-.17.38-.47.68-.85.85l-6.2 2.75c-.4.18-.78-.2-.6-.6l2.75-6.2c.17-.38.47-.68.85-.85l6.2-2.75ZM13.1 12a1.1 1.1 0 1 0-2.2 0 1.1 1.1 0 1 0 2.2 0Z";

/**
 * Approved 24px navigation SVGs, inlined to inherit the link's semantic color.
 * Keep geometry in sync with public/assets/galanda/navigation/*.svg.
 * The enclosing link's visible Korean label owns the accessible name.
 */
export function GlobalNavIcon({ navKey, active }: GlobalNavIconProps) {
  const shapes: Record<GlobalNavKey, ReactNode> = {
    HOME: (
      <path d="M3 10.5 10.7 3.78a2 2 0 0 1 2.6 0L21 10.5h-1.5v8.25A2.25 2.25 0 0 1 17.25 21h-2.5v-5.25a2.75 2.75 0 0 0-5.5 0V21h-2.5A2.25 2.25 0 0 1 4.5 18.75V10.5H3Z" />
    ),
    EXPLORE: active ? (
      <path
        d={`M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0Z${COMPASS_NEEDLE_PATH}`}
        stroke="none"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <path
          d={COMPASS_NEEDLE_PATH}
          fill="currentColor"
          stroke="none"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </>
    ),
    TRIPS: (
      <>
        <path
          d="M8.5 7V4.75C8.5 3.78 9.28 3 10.25 3h3.5c.97 0 1.75.78 1.75 1.75V7"
          fill="none"
        />
        <rect x="3" y="7" width="18" height="14" rx="2.5" />
      </>
    ),
    ME: (
      <>
        <circle cx="12" cy="6.5" r="3.5" />
        <path d="M3.5 21v-.75c0-4.15 2.9-6.75 6.5-6.75h4c3.6 0 6.5 2.6 6.5 6.75V21h-17Z" />
      </>
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      data-slot="global-nav-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[navKey]}
    </svg>
  );
}
