// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(() => ({ isSuccess: false, data: undefined })),
}));

import type { ExploreListingItem } from "../../../contracts/explore.ts";
import { ExploreListingCard } from "./ExploreListingCard.tsx";

const item = (over?: { title?: string }): ExploreListingItem => ({
  listingId: "listing-1" as ExploreListingItem["listingId"],
  status: "LISTED",
  listingRevision: 1 as ExploreListingItem["listingRevision"],
  listedAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  snapshot: {
    title: over?.title ?? "오사카 3박 4일",
    destination: "오사카",
    routes: [
      { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
    ],
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
    stays: [],
    transports: [],
    author: { displayName: "여행자A" },
    sourcePlanRevision: 3 as ExploreListingItem["snapshot"]["sourcePlanRevision"],
  },
});

const renderCard = (over?: { title?: string }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ExploreListingCard item={item(over)} />, { wrapper });
};

describe("ExploreListingCard (RAON-263 DISC-5 detail link)", () => {
  it("카드는 /explore/:listingId로 이동하는 native link다", () => {
    renderCard();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/explore/listing-1");
  });

  it("link의 accessible name은 제목이다", () => {
    renderCard({ title: "교토 벚꽃 여행" });
    expect(
      screen.getByRole("link", { name: "교토 벚꽃 여행" })
    ).toBeInTheDocument();
  });

  it("focus-visible ring과 긴 콘텐츠 줄바꿈을 보장한다", () => {
    renderCard({ title: "가".repeat(120) });
    // detail link가 focus-visible ring을 소유한다.
    const link = screen.getByRole("link");
    expect(link.className).toContain("focus-visible:outline-ring");
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.className).toContain("[overflow-wrap:anywhere]");
    expect(heading.className).toContain("min-w-0");
  });

  it("card container는 data-slot을 유지한다", () => {
    const { container } = renderCard();
    const card = container.querySelector(
      '[data-slot="explore-listing-card"]'
    );
    expect(card).not.toBeNull();
  });

  it("비로그인/세션 미준비 시 save toggle을 렌더하지 않는다", () => {
    renderCard();
    expect(
      screen.queryByRole("button", { name: /저장/ })
    ).not.toBeInTheDocument();
  });
});
