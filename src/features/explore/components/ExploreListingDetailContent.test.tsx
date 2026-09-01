// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { ExploreListingItem } from "../../../contracts/explore.ts";
import { ExploreListingDetailContent } from "./ExploreListingDetailContent.tsx";

const item = (over?: Partial<ExploreListingItem["snapshot"]>): ExploreListingItem => ({
  listingId: "listing-1" as ExploreListingItem["listingId"],
  status: "LISTED",
  listingRevision: 1 as ExploreListingItem["listingRevision"],
  saveCount: 0,
  listedAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  snapshot: {
    title: "오사카 3박 4일",
    destination: "오사카",
    routes: [
      { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-03" },
      { city: "교토", arrivalDate: "2026-09-03", departureDate: "2026-09-04" },
    ],
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
    stays: [
      { city: "오사카", hotelName: "난바 호텔", isSearching: false, nights: 2 },
      { city: "교토", hotelName: undefined, isSearching: true, nights: 1 },
      { city: "고베", hotelName: undefined, isSearching: false, nights: 1 },
    ],
    transports: [
      {
        fromCity: "인천",
        toCity: "오사카",
        mode: "비행기",
        hasTransfer: false,
        durationText: "1시간 30분",
      },
    ],
    author: { displayName: "여행자A" },
    sourcePlanRevision: 3 as ExploreListingItem["snapshot"]["sourcePlanRevision"],
    ...over,
  },
});

describe("ExploreListingDetailContent (RAON-263 DISC-5)", () => {
  it("공개 allowlist 필드를 순서대로 렌더링한다", () => {
    const { container } = render(<ExploreListingDetailContent item={item()} />);

    // 제목/목적지
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "오사카 3박 4일"
    );

    const root = container.querySelector('[data-slot="explore-listing-detail"]')!;
    const text = root.textContent ?? "";

    // section 순서: 경로 → 기간 → 숙소 → 교통
    const order = ["경로", "기간", "숙소", "교통"].map((label) =>
      text.indexOf(label)
    );
    expect(order.every((idx) => idx >= 0)).toBe(true);
    expect([...order]).toEqual([...order].sort((a, b) => a - b));

    // 경로 도시 + 날짜
    expect(text).toContain("오사카");
    expect(text).toContain("교토");
    // 기간
    expect(text).toContain("3박 4일");
    // 숙소(sanitized): 확정 이름과 찾는 중 상태
    expect(text).toContain("난바 호텔");
    expect(text).toContain("숙소 찾는 중");
    expect(text).toContain("숙소 미정");
    // 교통(sanitized)
    expect(text).toContain("인천 → 오사카");
    // 작성자
    expect(text).toContain("여행자A");
  });

  it("실제 snapshot theme ID만 server-owned label로 표시하고 누락 시 section을 만들지 않는다", () => {
    const { rerender } = render(
      <ExploreListingDetailContent item={item({ themeIds: ["culture"] })} />
    );
    expect(screen.getByRole("region", { name: "여행 테마" })).toHaveTextContent(
      "문화·예술"
    );

    rerender(<ExploreListingDetailContent item={item()} />);
    expect(
      screen.queryByRole("region", { name: "여행 테마" })
    ).not.toBeInTheDocument();
  });

  it("금지 필드(price/booking/status/opinion/private ID)를 노출하지 않는다", () => {
    const { container } = render(<ExploreListingDetailContent item={item()} />);
    const text =
      container.querySelector('[data-slot="explore-listing-detail"]')
        ?.textContent ?? "";
    // 예약/가격/확정 상태 어휘가 없어야 한다.
    expect(text).not.toMatch(/원|₩|예약|bookingUrl|확정자|NOT_CHECKED|의견/);
    // 이미지/인기 지표 없음.
    expect(container.querySelector("img")).toBeNull();
    expect(text).not.toMatch(/인기|조회수|저장수/);
  });

  it("action이 없으면 action slot DOM 자체를 렌더하지 않는다(dead CTA 금지)", () => {
    const { container } = render(<ExploreListingDetailContent item={item()} />);
    expect(
      container.querySelector('[data-slot="explore-listing-detail-action"]')
    ).toBeNull();
    // save/import 텍스트도 없어야 한다.
    expect(container.textContent ?? "").not.toMatch(/저장하기|가져오기|불러오기/);
  });

  it("action이 주어지면 분리된 slot에 렌더한다", () => {
    const { container } = render(
      <ExploreListingDetailContent
        item={item()}
        action={<button type="button">저장하기</button>}
      />
    );
    const slot = container.querySelector(
      '[data-slot="explore-listing-detail-action"]'
    )!;
    expect(slot).not.toBeNull();
    expect(
      within(slot as HTMLElement).getByRole("button", { name: "저장하기" })
    ).toBeVisible();
  });

  it("빈 숙소/교통은 해당 섹션을 렌더하지 않는다(빈 표시 금지)", () => {
    const { container } = render(
      <ExploreListingDetailContent item={item({ stays: [], transports: [] })} />
    );
    const text =
      container.querySelector('[data-slot="explore-listing-detail"]')
        ?.textContent ?? "";
    expect(text).not.toContain("숙소");
    expect(text).not.toContain("교통");
    // 경로/기간/작성자는 유지.
    expect(text).toContain("경로");
    expect(text).toContain("기간");
    expect(text).toContain("여행자A");
  });

  it("긴 제목/경로도 leaf에 overflow-wrap:anywhere가 적용된다", () => {
    const longTitle = "가".repeat(120);
    const { container } = render(
      <ExploreListingDetailContent item={item({ title: longTitle })} />
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("[overflow-wrap:anywhere]");
    expect(heading.className).toContain("min-w-0");
    expect(container.textContent).toContain(longTitle);
  });
});
