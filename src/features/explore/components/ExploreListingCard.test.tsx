// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  useSessionQuery: vi.fn<(...args: unknown[]) => unknown>(),
  useExploreSaveStateQuery: vi.fn<(...args: unknown[]) => unknown>(),
  useToggleExploreSaveMutation: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("../../../hooks/useSession.ts", () => ({
  useSessionQuery: mocks.useSessionQuery,
}));
vi.mock("../save-queries.ts", () => ({
  useExploreSaveStateQuery: mocks.useExploreSaveStateQuery,
  useToggleExploreSaveMutation: mocks.useToggleExploreSaveMutation,
}));

import type { ExploreListingItem } from "../../../contracts/explore.ts";
import { ExploreListingCard } from "./ExploreListingCard.tsx";

type ItemOverrides = {
  readonly title?: string;
  readonly destination?: string;
  readonly routes?: ExploreListingItem["snapshot"]["routes"];
  readonly authorName?: string;
  readonly listedAt?: string;
  readonly themeIds?: ExploreListingItem["snapshot"]["themeIds"];
};

const item = (over?: ItemOverrides): ExploreListingItem => ({
  listingId: "listing-1" as ExploreListingItem["listingId"],
  status: "LISTED",
  listingRevision: 1 as ExploreListingItem["listingRevision"],
  listedAt: over?.listedAt ?? "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  snapshot: {
    title: over?.title ?? "오사카 3박 4일",
    destination: over?.destination ?? "오사카",
    routes: over?.routes ?? [
      { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-03" },
      { city: "교토", arrivalDate: "2026-09-03", departureDate: "2026-09-04" },
    ],
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
    stays: [],
    transports: [],
    author: { displayName: over?.authorName ?? "여행자A" },
    sourcePlanRevision: 3 as ExploreListingItem["snapshot"]["sourcePlanRevision"],
    themeIds: over?.themeIds,
  },
});

const renderCard = (over?: ItemOverrides) =>
  render(
    <MemoryRouter>
      <ExploreListingCard item={item(over)} />
    </MemoryRouter>,
  );

describe("ExploreListingCard (RAON-263 DISC-5 detail link)", () => {
  beforeEach(() => {
    mocks.useSessionQuery.mockReturnValue({ isSuccess: true, data: { name: "나" } });
    mocks.useExploreSaveStateQuery.mockReturnValue({
      data: { saved: false },
      isPending: false,
    });
    mocks.useToggleExploreSaveMutation.mockReturnValue({
      isPending: false,
      isError: false,
      mutate: vi.fn<(...args: unknown[]) => unknown>(),
    });
  });

  it("detail native link와 save button을 nested하지 않고 형제로 유지한다", () => {
    const { container } = renderCard();
    const card = container.querySelector<HTMLElement>(
      '[data-slot="explore-listing-card"]',
    )!;
    const link = within(card).getByRole("link");
    const saveButton = within(card).getByRole("button", { name: "저장" });

    expect(link).toHaveAttribute("href", "/explore/listing-1");
    expect(link).not.toContainElement(saveButton);
    expect(link.nextElementSibling).toContainElement(saveButton);
  });

  it("link의 accessible name은 실제 제목이다", () => {
    renderCard({ title: "교토 벚꽃 여행" });
    expect(
      screen.getByRole("link", { name: "교토 벚꽃 여행" }),
    ).toBeInTheDocument();
  });

  it("실제 공개 필드와 semantic 목적지 visual만 렌더링한다", () => {
    const { container } = renderCard();
    const card = container.querySelector<HTMLElement>(
      '[data-slot="explore-listing-card"]',
    )!;
    const visual = container.querySelector<HTMLElement>(
      '[data-slot="explore-destination-visual"]',
    )!;

    expect(visual).toHaveClass("bg-primary-muted", "border-primary-border-weak");
    expect(visual).toHaveTextContent("오사카");
    expect(within(card).getByRole("heading", { level: 3 })).toHaveTextContent(
      "오사카 3박 4일",
    );
    expect(card).toHaveTextContent("오사카 → 교토");
    expect(card).toHaveTextContent("3박 4일 · 9.1 ~ 9.4");
    expect(card).toHaveTextContent("여행자A");
    expect(card).toHaveTextContent("공개일 2026.09.05");
    expect(card.querySelector("img")).toBeNull();
  });

  it("실제 snapshot theme ID만 server-owned label chip으로 표시한다", () => {
    renderCard({ themeIds: ["food", "nature"] });
    const themes = screen.getByRole("list", { name: "여행 테마" });
    expect(within(themes).getByText("미식")).toBeVisible();
    expect(within(themes).getByText("자연")).toBeVisible();
  });

  it("themeIds가 없는 legacy listing에는 분류를 추론해 만들지 않는다", () => {
    renderCard();
    expect(screen.queryByRole("list", { name: "여행 테마" })).not.toBeInTheDocument();
  });

  it("destination과 route city가 없으면 예시 도시를 만들지 않는다", () => {
    const { container } = renderCard({
      title: "긴 휴가",
      destination: " ",
      routes: [
        { city: " ", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
      ] as ExploreListingItem["snapshot"]["routes"],
    });
    const visual = container.querySelector<HTMLElement>(
      '[data-slot="explore-destination-visual"]',
    )!;

    expect(visual).toHaveTextContent("목적지 정보 없음");
    expect(visual).not.toHaveTextContent(/서울|오사카|교토/);
    expect(screen.queryByText("여행 경로")).not.toBeInTheDocument();
  });

  it("focus-visible ring과 긴 제목·도시명 줄바꿈을 보장한다", () => {
    const longText = "가".repeat(120);
    renderCard({
      title: longText,
      destination: longText,
      routes: [
        { city: longText, arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
      ] as ExploreListingItem["snapshot"]["routes"],
    });

    const link = screen.getByRole("link", { name: longText });
    expect(link.className).toContain("focus-visible:outline-ring");
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.className).toContain("[overflow-wrap:anywhere]");
    expect(heading.className).toContain("min-w-0");
    expect(screen.getAllByText(longText).length).toBeGreaterThanOrEqual(3);
  });

  it("card는 rounded semantic surface이며 fake image·ranking·search를 만들지 않는다", () => {
    const { container } = renderCard();
    const card = container.querySelector<HTMLElement>(
      '[data-slot="explore-listing-card"]',
    )!;

    expect(card).toHaveClass("rounded-2xl", "border-border", "bg-card");
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector("ol")).toBeNull();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/지금 뜨는|인기 도시|순위|가격|인원|알림/);
  });

  it("비로그인/세션 미준비 시 save toggle을 렌더하지 않는다", () => {
    mocks.useSessionQuery.mockReturnValue({ isSuccess: false, data: undefined });
    renderCard();
    expect(screen.queryByRole("button", { name: /저장/ })).not.toBeInTheDocument();
  });
});
