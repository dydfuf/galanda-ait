import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DecisionIconName = "compare" | "bookmark" | "import-plan" | "share";

const SIZE_CLASSES = { 16: "size-4", 20: "size-5", 24: "size-6" } as const;

type DecisionIconProps = {
  readonly size?: keyof typeof SIZE_CLASSES;
  readonly className?: string;
} & (
  | { readonly name: "bookmark"; readonly variant?: "outline" | "filled" }
  | { readonly name: Exclude<DecisionIconName, "bookmark">; readonly variant?: "outline" }
);

const SHAPES = {
  "compare": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M12 4v16" />
      <path d="M6.5 9h2m7 0h2M6.5 15h2m7 0h2" />
    </>
  ),
  "bookmark": (
    <>
      <path d="M7.5 3h9A2.5 2.5 0 0 1 19 5.5V21l-7-4-7 4V5.5A2.5 2.5 0 0 1 7.5 3Z" />
    </>
  ),
  "import-plan": (
    <>
      <path d="M12 3v11m-4-4 4 4 4-4" />
      <path d="M3 14v4.5A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5V14" />
    </>
  ),
  "share": (
    <>
      <path d="m8.2 10.6 7.1-3.7m-7.1 6.5 7.1 3.7" />
      <circle cx="5.5" cy="12" r="3" />
      <circle cx="18" cy="5.5" r="3" />
      <circle cx="18" cy="18.5" r="3" />
    </>
  ),
} satisfies Record<DecisionIconName, ReactNode>;

/**
 * 비교·보관·가져오기·공유용 아이콘. public/assets/galanda/decision과 형상을 맞춘다.
 * bookmark 채움은 호출부의 저장 상태를 따르며, 임시 저장 완료와는 별개다.
 * 색상은 부모가, 접근 가능한 이름은 버튼/링크의 한글 텍스트가 소유한다.
 */
export function DecisionIcon({ name, variant = "outline", size = 24, className }: DecisionIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      data-slot="decision-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "bookmark" && variant === "filled" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", SIZE_CLASSES[size], className)}
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
