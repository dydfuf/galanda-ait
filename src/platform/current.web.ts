import type { PlatformAdapter, PlatformRoute } from "./types.ts";
import { webAdapter } from "./web/adapter.ts";

/**
 * Web/PWA 기본 타깃의 플랫폼 구현이에요.
 *
 * `@platform/current`는 빌드 타깃에 따라 이 파일 또는 `current.ait.ts`로 alias돼요
 * (vite.config.ts / tsconfig). 이 파일은 `@apps-in-toss/*`를 import하지 않으므로
 * Web 빌드의 import graph에 AIT SDK가 들어가지 않아요.
 */
export const platformAdapter: PlatformAdapter = webAdapter;

/** Web 타깃에는 플랫폼 전용 라우트가 없어요. */
export const platformRoutes: ReadonlyArray<PlatformRoute> = [];
