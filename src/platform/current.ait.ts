import type { PlatformAdapter, PlatformRoute } from "./types.ts";
import { aitAdapter } from "./ait/adapter.ts";
import { InAppAdsPage } from "./ait/InAppAdsPage.tsx";

/**
 * Apps in Toss 타깃의 플랫폼 구현이에요 (`--mode ait` 빌드에서만 사용돼요).
 * `@platform/current` alias가 이 파일을 가리킬 때만 AIT SDK가 번들에 포함돼요.
 */
export const platformAdapter: PlatformAdapter = aitAdapter;

/** 인앱 광고 디버그 화면은 AIT 타깃에서만 라우팅해요. */
export const platformRoutes: ReadonlyArray<PlatformRoute> = [
  { path: "/iaa", Component: InAppAdsPage },
];
