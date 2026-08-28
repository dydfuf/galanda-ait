// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevisionSchema } from "../../core/domain/ids.ts";
import { useNextTripActionRecommendation } from "./use-next-trip-action-recommendation.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const response = (tripRevision: number) => Response.json({
  recommendationId: "recommendation-1",
  primary: {
    actionId: "COMPARE_PLANS",
    reasonCode: "COMPARE_PLAN_OPTIONS",
  },
  alternatives: [{ actionId: "GIVE_OPINION" }],
  source: "RULE",
  policyVersion: "nba-rule-v1",
  tripRevision,
  contextFingerprint: "fingerprint",
});

describe("useNextTripActionRecommendation", () => {
  it("현재 room revision과 다른 늦은 응답은 화면에 노출하지 않는다", async () => {
    globalThis.fetch = vi.fn<() => Promise<Response>>(async () => response(2));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useNextTripActionRecommendation(
        "trip-1",
        { surface: "PLAN_HOME" },
        RevisionSchema.make(3),
      ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("유효한 cached recommendation은 재진입 시 loading flash 없이 재사용한다", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () => response(3));
    globalThis.fetch = fetchMock;
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 5 * 60 * 1000 },
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const useRecommendation = () => useNextTripActionRecommendation(
      "trip-1",
      { surface: "PLAN_HOME" },
      RevisionSchema.make(3),
    );

    const first = renderHook(useRecommendation, { wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();
    const second = renderHook(useRecommendation, { wrapper });

    expect(second.result.current.data?.recommendationId).toBe("recommendation-1");
    expect(second.result.current.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
