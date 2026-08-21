import type { PlatformAdapter, ShareMessage, ShareOutcome } from "../types.ts";

/** 사용자가 공유 시트를 직접 닫으면 Web Share API가 AbortError로 reject해요. */
export function isShareAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function copyToClipboard(url: string): Promise<ShareOutcome> {
  try {
    if (!navigator.clipboard) throw new Error("clipboard is unavailable");
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "unsupported";
  }
}

async function shareWithBrowser(message: ShareMessage): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: message.title,
        text: message.text,
        url: message.url,
      });
      return "shared";
    } catch (error: unknown) {
      // 사용자가 취소한 경우에는 클립보드에 몰래 복사하지 않고 그대로 끝내요.
      if (isShareAbortError(error)) return "cancelled";
    }
  }

  return copyToClipboard(message.url);
}

export const webAdapter: PlatformAdapter = {
  name: "web",
  share: shareWithBrowser,
  openExternalUrl: async (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  requestClose: async () => false,
  navigation: undefined,
};
