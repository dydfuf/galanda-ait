import type { ComponentType } from "react";

/**
 * 공통 feature가 사용할 수 있는 플랫폼 능력 계약이에요.
 * 구현은 web(브라우저 표준 API)과 ait(Apps in Toss SDK) 두 가지가 있고,
 * feature 코드는 이 계약만 알면 돼요.
 *
 * 어떤 구현이 번들에 들어갈지는 **빌드 타임**에 결정돼요(`@platform/current` alias).
 * 덕분에 Web 빌드의 import graph에는 `@apps-in-toss/*`가 아예 들어가지 않아요.
 */

export interface ShareMessage {
  readonly title?: string;
  readonly text?: string;
  readonly url: string;
}

/**
 * 공유 시도 결과.
 * - `shared`: 공유 완료
 * - `copied`: 공유 시트를 쓸 수 없어 클립보드로 복사
 * - `cancelled`: 사용자가 공유 시트를 직접 닫음 (추가 동작 없이 조용히 끝내요)
 * - `unsupported`: 공유도 복사도 불가능
 */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "unsupported";

export interface AccessoryButtonOptions {
  readonly id: string;
  readonly title: string;
  readonly iconName: string;
  readonly callback: VoidFunction;
}

/** 네이티브 shell이 소유한 상단 내비게이션(액세서리 버튼) 제어. */
export interface PlatformNavigation {
  readonly addAccessoryButton: (options: AccessoryButtonOptions) => Promise<void>;
  readonly removeAccessoryButton: VoidFunction;
}

export interface PlatformAdapter {
  readonly name: "web" | "ait";
  /** 링크 공유. 플랫폼별 공유 시트 → 클립보드 순서로 시도해요. */
  readonly share: (message: ShareMessage) => Promise<ShareOutcome>;
  /** 예약/교통 링크 등 앱 밖 URL 열기. */
  readonly openExternalUrl: (url: string) => Promise<void>;
  /** 미니앱/네이티브 화면 닫기. 처리했으면 true, 브라우저처럼 닫을 수 없으면 false. */
  readonly requestClose: () => Promise<boolean>;
  /**
   * 네이티브 shell navigation.
   * AIT 빌드라도 실제 토스 앱 WebView가 아니면 undefined예요(= 웹 헤더를 그려야 해요).
   */
  readonly navigation?: PlatformNavigation;
}

/** 특정 플랫폼 타깃에서만 존재하는 라우트 (예: AIT 광고 디버그 화면). */
export interface PlatformRoute {
  readonly path: string;
  readonly Component: ComponentType;
}
