import { Frown, Meh, ThumbsUp } from "lucide-react";

/**
 * 반응(LIKE/OKAY/HARD)의 "표시 방법"에 대한 단일 출처.
 *
 * 공유하는 것은 표시 순서 · 한글 label · 장식용 lucide 아이콘뿐이며,
 * domain 타입 유니온이나 반응의 의미는 여기서 정의하지 않는다.
 * 배열 순서(LIKE → OKAY → HARD)가 곧 화면 노출 순서다.
 */
export const REACTION_DISPLAY = [
  { key: "LIKE", label: "좋아요", Icon: ThumbsUp },
  { key: "OKAY", label: "괜찮아요", Icon: Meh },
  { key: "HARD", label: "어려워요", Icon: Frown },
] as const;

/** `REACTION_DISPLAY`에서 파생한 표시용 키. 유니온을 손으로 다시 적지 않는다. */
export type ReactionDisplayKey = (typeof REACTION_DISPLAY)[number]["key"];

/** 반응에 대응하는 한글 label. 반응이 없으면 `undefined`. */
export const getReactionLabel = (reaction?: ReactionDisplayKey): string | undefined =>
  REACTION_DISPLAY.find((entry) => entry.key === reaction)?.label;
