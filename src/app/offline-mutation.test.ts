// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOnlineForRequest,
  isOfflineMutationError,
  isUnsafeHttpMethod,
  OFFLINE_MUTATION_MESSAGE,
  OfflineMutationError,
} from "./offline-mutation.ts";

describe("offline mutation guard", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["GET", "HEAD", "OPTIONS"])("offline %s is allowed", (method) => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(() => assertOnlineForRequest(method)).not.toThrow();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "offline %s is blocked before fetch",
    (method) => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      expect(() => assertOnlineForRequest(method)).toThrow(OfflineMutationError);
      expect(() => assertOnlineForRequest(method)).toThrow(
        OFFLINE_MUTATION_MESSAGE,
      );
    },
  );

  it("defaults an omitted method to safe GET", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(isUnsafeHttpMethod()).toBe(false);
    expect(() => assertOnlineForRequest()).not.toThrow();
  });

  it("allows mutations while online and recognizes the stable error code", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    expect(() => assertOnlineForRequest("POST")).not.toThrow();

    const error = new OfflineMutationError();
    expect(error.code).toBe("OFFLINE_MUTATION_BLOCKED");
    expect(isOfflineMutationError(error)).toBe(true);
    expect(
      isOfflineMutationError(
        Object.assign(new Error(error.message), { code: error.code }),
      ),
    ).toBe(true);
  });
});
