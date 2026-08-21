/**
 * 공통 feature가 사용할 수 있는 플랫폼 능력 계약이에요.
 * 구현은 web(브라우저 표준 API)과 ait(Apps in Toss SDK) 두 가지가 있고,
 * feature 코드는 이 계약만 알면 돼요. `@apps-in-toss/*`는 여기 아래(ait/)에만 존재해요.
 */

export interface ShareMessage {
  readonly title?: string;
  readonly text?: string;
  readonly url: string;
}

/** 공유 시도 결과: 공유 완료 / 클립보드 복사로 대체 / 지원 안 됨. */
export type ShareOutcome = "shared" | "copied" | "unsupported";

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
  /** 미니앱/네이티브 화면 닫기. 처리했으면 true, 브라우저처럼 닫을 수 없으면 false. */
  readonly requestClose: () => boolean;
  /** 네이티브 shell navigation. 일반 브라우저에서는 undefined예요. */
  readonly navigation?: PlatformNavigation;
}
