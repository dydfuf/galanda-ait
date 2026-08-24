import {
  appLogin,
  Clipboard,
  Device,
  partner,
  SafeAreaInsets,
  Screen,
  Share,
  tdsEvent,
} from "@apps-in-toss/web-framework";
import type {
  AccessoryButtonOptions,
  PlatformAdapter,
  PlatformNavigation,
  ShareMessage,
  ShareOutcome,
} from "../types.ts";
import { copyToClipboard, webAdapter } from "../web/adapter.ts";
import { postAuthJson, safeReturnTo } from "../auth.ts";

// ponytail: 구형 host/mock이 초기 inset을 주입하지 않을 때의 partner nav 실측값.
const PARTNER_NAV_FALLBACK_TOP_INSET = 54;

const getPartnerFallbackTopInset = () =>
  typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches
    ? PARTNER_NAV_FALLBACK_TOP_INSET
    : 0;

export function toContentTopInset(value: number, fallback = 0): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** 실제 토스 앱 WebView 안에서 실행 중인지 확인해요 (AIT 빌드를 브라우저로 열어볼 수도 있어요). */
export function isTossAppRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("TossApp/");
}

async function shareWithToss(message: ShareMessage): Promise<ShareOutcome> {
  try {
    await Share.sendMessage({ message: message.url });
    return "shared";
  } catch {
    // 미지원 앱 버전에서는 브라우저 공유로 fallback해요.
  }

  // 사용자가 브라우저 공유 시트를 취소했다면 클립보드 복사까지 가지 않아요.
  const browserOutcome = await webAdapter.share(message);
  if (browserOutcome !== "unsupported") {
    return browserOutcome;
  }

  try {
    await Clipboard.setText(message.url);
    return "copied";
  } catch {
    return copyToClipboard(message.url);
  }
}

function createTossNavigation(): PlatformNavigation {
  let removeAccessoryListener: (() => void) | undefined;

  return {
    contentTopInset: toContentTopInset(
      SafeAreaInsets.get().top,
      getPartnerFallbackTopInset(),
    ),
    subscribeContentTopInset: (onChange) =>
      SafeAreaInsets.subscribe({
        onEvent: ({ top }) => onChange(toContentTopInset(top, getPartnerFallbackTopInset())),
      }),
    addAccessoryButton: ({ id, title, iconName, callback }: AccessoryButtonOptions) => {
      removeAccessoryListener?.();
      const removeListener = tdsEvent.addEventListener("navigationAccessoryEvent", {
        onEvent: (event) => {
          if (event.id === id) callback();
        },
      });
      removeAccessoryListener = removeListener;

      return partner
        .addAccessoryButton({ id, title, icon: { name: iconName } })
        .catch((error: unknown) => {
          removeListener();
          if (removeAccessoryListener === removeListener) {
            removeAccessoryListener = undefined;
          }
          console.error("앱인토스 액세서리 등록 실패:", error);
          throw error;
        });
    },
    removeAccessoryButton: () => {
      removeAccessoryListener?.();
      removeAccessoryListener = undefined;
      void partner
        .removeAccessoryButton()
        .catch((error: unknown) => console.error("앱인토스 액세서리 제거 실패:", error));
    },
  };
}

export const aitAdapter: PlatformAdapter = {
  name: "ait",
  signIn: async (returnTo) => {
    const login = await appLogin();
    await postAuthJson("/api/auth/sign-in/toss", login);
    window.location.assign(safeReturnTo(returnTo));
  },
  share: shareWithToss,
  openExternalUrl: async (url: string) => {
    try {
      await Device.openURL(url);
    } catch {
      await webAdapter.openExternalUrl(url);
    }
  },
  requestClose: async () => {
    try {
      await Screen.close();
      return true;
    } catch {
      return false;
    }
  },
  // 네이티브 shell이 없는 환경(브라우저에서 연 AIT 빌드)에서는 웹 헤더를 그려야 해요.
  navigation: isTossAppRuntime() ? createTossNavigation() : undefined,
};
