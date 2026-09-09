import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PlanningIconName = "calendar" | "route" | "stay" | "ticket";

const SIZE_CLASSES = { 16: "size-4", 20: "size-5", 24: "size-6" } as const;

interface PlanningIconProps {
  readonly name: PlanningIconName;
  readonly size?: keyof typeof SIZE_CLASSES;
  readonly className?: string;
}

const SHAPES = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M8 3v4m8-4v4M3 10h18" />
      <path d="M7.5 14h2m5 0h2m-9 4h2m5 0h2" />
    </>
  ),
  route: (
    <>
      <path d="M7 19h8a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h8" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
    </>
  ),
  stay: (
    <>
      <path d="M5 11V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V11" />
      <path d="M8 11V9.5A1.5 1.5 0 0 1 9.5 8h5A1.5 1.5 0 0 1 16 9.5V11" />
      <rect x="3" y="11" width="18" height="7" rx="2.5" />
      <path d="M5 18v3m14-3v3" />
    </>
  ),
  ticket: (
    <>
      <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5V9a3 3 0 0 0 0 6v1.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5V15a3 3 0 0 0 0-6V7.5A2.5 2.5 0 0 1 5.5 5Z" />
      <path d="M9 8v1m0 2.5v1m0 2.5v1" />
    </>
  ),
} satisfies Record<PlanningIconName, ReactNode>;

/**
 * 여행 준비 항목용 outline 아이콘. 예약 완료나 탭 선택 상태를 나타내지 않는다.
 * public/assets/galanda/planning/*.svg와 형상을 함께 갱신한다.
 * 색상은 부모의 semantic token, 접근 가능한 이름은 옆의 텍스트가 소유한다.
 */
export function PlanningIcon({ name, size = 24, className }: PlanningIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      data-slot="planning-icon"
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
