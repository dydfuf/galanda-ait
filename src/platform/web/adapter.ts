import type { PlatformAdapter, ShareMessage, ShareOutcome } from "../types.ts";

async function shareWithBrowser(message: ShareMessage): Promise<ShareOutcome> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({
        title: message.title,
        text: message.text,
        url: message.url,
      });
      return "shared";
    }
  } catch {
    // 사용자가 공유 시트를 닫은 경우도 클립보드 fallback으로 복구해요.
  }

  try {
    if (!navigator.clipboard) throw new Error("clipboard is unavailable");
    await navigator.clipboard.writeText(message.url);
    return "copied";
  } catch {
    return "unsupported";
  }
}

export const webAdapter: PlatformAdapter = {
  name: "web",
  share: shareWithBrowser,
  requestClose: () => false,
  navigation: undefined,
};
