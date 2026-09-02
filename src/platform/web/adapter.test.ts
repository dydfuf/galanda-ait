import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard, isShareAbortError, webAdapter } from "./adapter.ts";

describe("Web platform adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("identifies AbortError from DOMException correctly", () => {
    expect(isShareAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isShareAbortError(new Error("Generic error"))).toBe(false);
    expect(isShareAbortError(null)).toBe(false);
  });

  it("handles navigator.share success", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share: shareMock });

    const result = await webAdapter.share({
      title: "Test Title",
      text: "Test Text",
      url: "https://example.com",
    });

    expect(result).toBe("shared");
    expect(shareMock).toHaveBeenCalledWith({
      title: "Test Title",
      text: "Test Text",
      url: "https://example.com",
    });
  });

  it("returns cancelled on user AbortError without fallback to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const shareMock = vi.fn().mockRejectedValue(new DOMException("User aborted", "AbortError"));
    vi.stubGlobal("navigator", { share: shareMock, clipboard: { writeText } });

    const result = await webAdapter.share({
      title: "Test",
      url: "https://example.com",
    });

    expect(result).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when navigator.share fails with general error", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const shareMock = vi.fn().mockRejectedValue(new Error("Share failed"));
    vi.stubGlobal("navigator", { share: shareMock, clipboard: { writeText } });

    const result = await webAdapter.share({
      title: "Test",
      url: "https://example.com",
    });

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.com");
  });

  it("returns unsupported when clipboard is unavailable or throws", async () => {
    const shareMock = vi.fn().mockRejectedValue(new Error("Share failed"));
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard permission denied"));
    vi.stubGlobal("navigator", { share: shareMock, clipboard: { writeText } });

    const result = await webAdapter.share({
      title: "Test",
      url: "https://example.com",
    });

    expect(result).toBe("unsupported");
  });

  it("returns unsupported from copyToClipboard if clipboard is missing", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyToClipboard("https://example.com")).toBe("unsupported");
  });

  it("opens external URL in new tab using window.open", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("window", { open: openMock });

    await webAdapter.openExternalUrl("https://external.example.com");
    expect(openMock).toHaveBeenCalledWith(
      "https://external.example.com",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("returns false for requestClose", async () => {
    expect(await webAdapter.requestClose()).toBe(false);
  });
});
