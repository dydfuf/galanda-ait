import { Clipboard, partner, Screen, Share, tdsEvent } from "@apps-in-toss/web-framework";
import type {
  AccessoryButtonOptions,
  PlatformAdapter,
  PlatformNavigation,
  ShareMessage,
  ShareOutcome,
} from "../types.ts";
import { webAdapter } from "../web/adapter.ts";

async function shareWithToss(message: ShareMessage): Promise<ShareOutcome> {
  try {
    await Share.sendMessage({ message: message.url });
    return "shared";
  } catch {
    // 미지원 앱 버전에서는 브라우저 공유로 fallback해요.
  }

  const browserOutcome = await webAdapter.share(message);
  if (browserOutcome !== "unsupported") {
    return browserOutcome;
  }

  try {
    await Clipboard.setText(message.url);
    return "copied";
  } catch {
    return "unsupported";
  }
}

function createTossNavigation(): PlatformNavigation {
  let removeAccessoryListener: (() => void) | undefined;

  return {
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
  share: shareWithToss,
  requestClose: () => {
    try {
      Screen.close();
      return true;
    } catch {
      return false;
    }
  },
  navigation: createTossNavigation(),
};
