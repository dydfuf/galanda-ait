import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ActionIconName = "create-trip" | "companions" | "invite" | "complete";

const SIZE_CLASSES = { 16: "size-4", 20: "size-5", 24: "size-6" } as const;

interface ActionIconProps {
  readonly name: ActionIconName;
  readonly size?: keyof typeof SIZE_CLASSES;
  readonly className?: string;
}

const SHAPES = {
  "create-trip": (
    <>
      <path d="M8.5 7V4.75C8.5 3.78 9.28 3 10.25 3h3.5c.97 0 1.75.78 1.75 1.75V7" />
      <path d="M12 21H5.5A2.5 2.5 0 0 1 3 18.5v-9A2.5 2.5 0 0 1 5.5 7h13A2.5 2.5 0 0 1 21 9.5V12" />
      <path d="M18 15v6m-3-3h6" />
    </>
  ),
  companions: (
    <>
      <circle cx="8.5" cy="6.5" r="3.5" />
      <path d="M2.5 21v-1.5c0-3.3 2.05-6 5-6h2c2.95 0 5 2.7 5 6V21h-12Z" />
      <path d="M16 3.5a3 3 0 0 1 0 6m2 4c2.05 0 3.5 2.05 3.5 4.75V21H18" />
    </>
  ),
  invite: (
    <>
      <circle cx="8.5" cy="6.5" r="3.5" />
      <path d="M2.5 21v-1.5c0-3.3 2.05-6 5-6h2c2.95 0 5 2.7 5 6V21h-12Z" />
      <path d="M18.5 4v6m-3-3h6" />
    </>
  ),
  complete: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.5 12 3 3 6-6" />
    </>
  ),
} satisfies Record<ActionIconName, ReactNode>;

/**
 * 시작·협업·완료 문맥용 outline 아이콘. 의미는 옆의 텍스트가 소유한다.
 * public/assets/galanda/actions/*.svg와 형상을 함께 갱신한다.
 * complete는 호출부가 확인한 성공 상태에만 사용하며 예약 완료를 뜻하지 않는다.
 */
export function ActionIcon({ name, size = 24, className }: ActionIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      data-slot="action-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
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
