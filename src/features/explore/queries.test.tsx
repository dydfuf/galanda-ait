// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../app/api-client.ts", () => ({
  getExploreListingDetail: vi.fn(),
  getExploreListings: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import { getExploreListingDetail } from "../../app/api-client.ts";
import type { ExploreListingId } from "../../core/domain/ids.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { useExploreListingDetailQuery } from "./queries.ts";

const mockGetDetail = vi.mocked(getExploreListingDetail);
const mockUseSession = vi.mocked(useSessionQuery);

describe("useExploreListingDetailQuery", () => {
  beforeEach(() => {
    mockGetDetail.mockReset();
    mockUseSession.mockReturnValue({
      isSuccess: true,
    } as ReturnType<typeof useSessionQuery>);
  });

  it("listingId가 없으면 session이 준비돼도 detail endpoint를 호출하지 않는다", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useExploreListingDetailQuery("" as ExploreListingId),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetDetail).not.toHaveBeenCalled();
  });
});
