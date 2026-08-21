import type { PlatformAdapter } from "./types.ts";
import { webAdapter } from "./web/adapter.ts";
import { aitAdapter } from "./ait/adapter.ts";

export type {
  AccessoryButtonOptions,
  PlatformAdapter,
  PlatformNavigation,
  ShareMessage,
  ShareOutcome,
} from "./types.ts";

/** Apps in Toss 앱 내부(WebView)에서 실행 중인지 감지해요. */
export function isTossAppRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("TossApp/");
}

/** 현재 런타임에 맞는 플랫폼 어댑터예요. 기본은 Web/PWA이고 토스 앱 안에서만 AIT예요. */
export const platform: PlatformAdapter = isTossAppRuntime() ? aitAdapter : webAdapter;
