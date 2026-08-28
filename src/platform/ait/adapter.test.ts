import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformAdapter } from "../types.ts";

const sdkMocks = vi.hoisted(() => ({
  appLogin: vi.fn(async () => ({})),
  Clipboard: {
    setText: vi.fn(async () => undefined),
  },
  Device: {
    openURL: vi.fn(async () => undefined),
  },
  partner: {
    addAccessoryButton: vi.fn(async () => undefined),
    removeAccessoryButton: vi.fn(async () => undefined),
  },
  SafeAreaInsets: {
    get: vi.fn(() => ({ top: 54 })),
    subscribe: vi.fn<
      (options: { onEvent: (event: { top: number }) => void }) => VoidFunction
    >(() => vi.fn()),
  },
  Screen: {
    close: vi.fn(async () => undefined),
  },
  Share: {
    sendMessage: vi.fn(async () => undefined),
  },
  tdsEvent: {
    addEventListener: vi.fn<
      (
        eventName: string,
        options: { onEvent: (event: { id: string }) => void },
      ) => VoidFunction
    >(() => vi.fn()),
  },
}));

vi.mock("@apps-in-toss/web-framework", () => sdkMocks);

async function loadAdapter(userAgent = "TossApp/5.0", portrait = true) {
  vi.stubGlobal("navigator", { userAgent });
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({ matches: portrait })),
  });
  return import("./adapter.ts");
}

beforeEach(() => {
  vi.resetModules();
  sdkMocks.SafeAreaInsets.get.mockReset().mockReturnValue({ top: 54 });
  sdkMocks.SafeAreaInsets.subscribe
    .mockReset()
    .mockImplementation(() => vi.fn());
  sdkMocks.partner.addAccessoryButton.mockReset().mockResolvedValue(undefined);
  sdkMocks.partner.removeAccessoryButton
    .mockReset()
    .mockResolvedValue(undefined);
  sdkMocks.tdsEvent.addEventListener
    .mockReset()
    .mockImplementation(() => vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Apps in Toss platform adapter integration", () => {
  it("uses a fallback only when the host content inset is unavailable", async () => {
    const { toContentTopInset } = await loadAdapter("Browser/1.0");

    expect(toContentTopInset(54, 40)).toBe(54);
    expect(toContentTopInset(0, 54)).toBe(54);
    expect(toContentTopInset(Number.NaN, 54)).toBe(54);
    expect(toContentTopInset(0)).toBe(0);
  });

  it("exposes native navigation only inside TossApp runtime through PlatformAdapter", async () => {
    const browserModule = await loadAdapter("Browser/1.0");
    const browserAdapter: PlatformAdapter = browserModule.aitAdapter;
    expect(browserAdapter.navigation).toBeUndefined();

    vi.resetModules();
    const tossModule = await loadAdapter();
    const tossAdapter: PlatformAdapter = tossModule.aitAdapter;
    expect(tossAdapter.name).toBe("ait");
    expect(tossAdapter.navigation?.contentTopInset).toBe(54);
  });

  it("maps native inset and accessory SDK events to the provider-neutral navigation contract", async () => {
    let emitInset: ((event: { top: number }) => void) | undefined;
    const removeInsetListener = vi.fn();
    sdkMocks.SafeAreaInsets.subscribe.mockImplementation((options) => {
      emitInset = options.onEvent;
      return removeInsetListener;
    });

    let emitAccessory: ((event: { id: string }) => void) | undefined;
    const removeAccessoryListener = vi.fn();
    sdkMocks.tdsEvent.addEventListener.mockImplementation(
      (_eventName, options) => {
        emitAccessory = options.onEvent;
        return removeAccessoryListener;
      },
    );

    const { aitAdapter } = await loadAdapter();
    const navigation = aitAdapter.navigation;
    expect(navigation).toBeDefined();

    const onInsetChange = vi.fn();
    const unsubscribe = navigation!.subscribeContentTopInset(onInsetChange);
    emitInset?.({ top: 72 });
    emitInset?.({ top: 0 });
    expect(onInsetChange.mock.calls).toEqual([[72], [54]]);
    expect(unsubscribe).toBe(removeInsetListener);

    const callback = vi.fn();
    await navigation!.addAccessoryButton({
      id: "galanda-share-invite",
      title: "공유",
      iconName: "icon-share-mono",
      callback,
    });

    expect(sdkMocks.tdsEvent.addEventListener).toHaveBeenCalledWith(
      "navigationAccessoryEvent",
      { onEvent: expect.any(Function) },
    );
    expect(sdkMocks.partner.addAccessoryButton).toHaveBeenCalledWith({
      id: "galanda-share-invite",
      title: "공유",
      icon: { name: "icon-share-mono" },
    });

    emitAccessory?.({ id: "another-accessory" });
    emitAccessory?.({ id: "galanda-share-invite" });
    expect(callback).toHaveBeenCalledTimes(1);

    navigation!.removeAccessoryButton();
    expect(removeAccessoryListener).toHaveBeenCalledTimes(1);
    expect(sdkMocks.partner.removeAccessoryButton).toHaveBeenCalledTimes(1);
  });

  it("propagates native accessory rejection after releasing the SDK listener for web fallback", async () => {
    const nativeError = new Error("native accessory unavailable");
    const removeAccessoryListener = vi.fn();
    sdkMocks.tdsEvent.addEventListener.mockReturnValue(removeAccessoryListener);
    sdkMocks.partner.addAccessoryButton.mockRejectedValue(nativeError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { aitAdapter } = await loadAdapter();
    const registration = aitAdapter.navigation!.addAccessoryButton({
      id: "galanda-share-invite",
      title: "공유",
      iconName: "icon-share-mono",
      callback: vi.fn(),
    });

    await expect(registration).rejects.toBe(nativeError);
    expect(removeAccessoryListener).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "앱인토스 액세서리 등록 실패:",
      nativeError,
    );
  });
});
