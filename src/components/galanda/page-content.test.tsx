// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ItemDescription, ItemTitle } from "@/components/ui/item";

import { MobileList, MobileListItem } from "./mobile-list.tsx";
import { PageState } from "./page-state.tsx";
import { GalandaSpot } from "./galanda-spot.tsx";
import { PageTitle } from "./page-title.tsx";
import { SectionHeader } from "./section-header.tsx";

describe("PageState", () => {
  it("keeps decorative art out of announcements and removes it on loading/error", () => {
    const { container, rerender } = render(
      <PageState status="empty" title="저장한 여행 일정이 없어요" illustration={<GalandaSpot name="empty-saved" />} />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelector("img")?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("저장한 여행 일정이 없어요");

    rerender(<PageState status="loading" message="불러오는 중이에요" />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<PageState status="error" title="불러오지 못했어요" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했어요");
  });

  it("announces only the loading state and keeps its text when motion is reduced", () => {
    const { container } = render(
      <PageState status="loading" message="여행 정보를 불러오는 중이에요." />,
    );

    const status = screen.getByRole("status");
    const message = within(status).getByText("여행 정보를 불러오는 중이에요.");
    const spinner = status.querySelector('[data-slot="spinner"]');

    expect(container.querySelectorAll("[data-system-state]")).toHaveLength(1);
    expect(status).toHaveAttribute("data-system-state", "loading");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(message).toBeVisible();
    expect(message.className).toContain("text-base");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect((spinner as SVGElement).className.baseVal).toContain(
      "motion-reduce:animate-none",
    );
  });

  it("announces an empty result as a non-error state without a retry action", () => {
    const { container } = render(
      <PageState
        status="empty"
        title="아직 여행이 없어요"
        description="새 여행을 만들면 여기에 표시돼요."
      />,
    );

    const status = screen.getByRole("status");

    expect(container.querySelectorAll("[data-system-state]")).toHaveLength(1);
    expect(status.closest('[data-system-state="empty"]')).not.toBeNull();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "아직 여행이 없어요",
    );
    expect(screen.getByText("새 여행을 만들면 여기에 표시돼요.").className).toContain(
      "text-base",
    );
  });

  it("announces only the error state and exposes retry only when it is available", () => {
    const retry = vi.fn();
    const { container, rerender } = render(
      <PageState
        status="error"
        title="여행을 불러오지 못했어요"
        description="잠시 후 다시 확인해 주세요."
      />,
    );

    expect(container.querySelectorAll("[data-system-state]")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행을 불러오지 못했어요",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다시 시도" }),
    ).not.toBeInTheDocument();

    rerender(
      <PageState
        status="error"
        title="여행을 불러오지 못했어요"
        description="잠시 후 다시 확인해 주세요."
        onAction={retry}
      />,
    );

    const retryButton = screen.getByRole("button", { name: "다시 시도" });
    fireEvent.click(retryButton);

    expect(container.querySelectorAll("[data-system-state]")).toHaveLength(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("MobileList", () => {
  it("uses list semantics and real 44px row actions with visible accessible names", () => {
    const selectTrip = vi.fn();

    render(
      <MemoryRouter>
        <MobileList aria-label="여행 목록">
          <MobileListItem to="/trips/trip-1" chevron>
            <ItemTitle>오사카 가족 여행</ItemTitle>
            <ItemDescription>2027년 봄 출발</ItemDescription>
          </MobileListItem>
          <MobileListItem onClick={selectTrip}>
            <ItemTitle>제주도 우정 여행</ItemTitle>
            <ItemDescription>일정을 함께 정해 보세요</ItemDescription>
          </MobileListItem>
        </MobileList>
      </MemoryRouter>,
    );

    const list = screen.getByRole("list", { name: "여행 목록" });
    const rows = within(list).getAllByRole("listitem");
    const link = within(rows[0]).getByRole("link", {
      name: /오사카 가족 여행 2027년 봄 출발/,
    });
    const button = within(rows[1]).getByRole("button", {
      name: /제주도 우정 여행 일정을 함께 정해 보세요/,
    });

    expect(rows).toHaveLength(2);
    expect(link).toHaveAttribute("href", "/trips/trip-1");
    expect(link).not.toHaveAttribute("aria-label");
    expect(button).not.toHaveAttribute("aria-label");
    for (const rowAction of [link, button]) {
      expect(rowAction.className).toContain("min-h-(--touch-target-min)");
      expect(rowAction.className).toContain("w-full");
    }

    fireEvent.click(button);
    expect(selectTrip).toHaveBeenCalledTimes(1);
  });

  it("keeps long row content visible, accessible, and able to wrap", () => {
    const longTitle =
      "공백없이이어지는아주긴여행제목과목적지이름을끝까지확인할수있는여행";
    const longDescription =
      "https://example.com/trips/a-very-long-unbroken-destination-and-schedule-reference";
    const longTrailing = "아주긴작성자이름과확인대기상태";

    render(
      <MemoryRouter>
        <MobileList aria-label="긴 여행 정보">
          <MobileListItem to="/trips/long" trailing={<span>{longTrailing}</span>}>
            <ItemTitle>{longTitle}</ItemTitle>
            <ItemDescription>{longDescription}</ItemDescription>
          </MobileListItem>
        </MobileList>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", {
      name: (accessibleName) =>
        accessibleName.includes(longTitle) &&
        accessibleName.includes(longDescription) &&
        accessibleName.includes(longTrailing),
    });
    const content = link.querySelector('[data-slot="item-content"]');
    const actions = link.querySelector('[data-slot="item-actions"]');

    expect(screen.getByText(longTitle)).toBeVisible();
    expect(screen.getByText(longDescription)).toBeVisible();
    expect(screen.getByText(longTrailing)).toBeVisible();
    expect(link).not.toHaveAttribute("aria-label");
    expect(link.className).toContain("min-w-0");
    expect(content?.className).toContain("min-w-0");
    expect(content?.className).toContain("[overflow-wrap:anywhere]");
    expect(content?.className).toContain(
      "[&_[data-slot=item-title]]:[overflow-wrap:anywhere]",
    );
    expect(content?.className).toContain(
      "[&_[data-slot=item-description]]:[overflow-wrap:anywhere]",
    );
    expect(actions?.className).toContain("max-w-[45%]");
    expect(actions?.className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("content heading hierarchy", () => {
  it("preserves the h1 to h2 to h3 outline and wraps long visible headings", () => {
    const pageTitle =
      "참여자모두가확인해야하는공백없는아주긴여행방화면제목";
    const sectionTitle =
      "여러여행안을비교하기위한공백없는아주긴후보목록제목";
    const cardTitle = "첫번째공백없는아주긴후보여행안제목";

    render(
      <>
        <PageTitle
          title={pageTitle}
          description="화면 설명도 생략되거나 접근성 트리에서 숨겨지지 않아요."
        />
        <SectionHeader
          title={sectionTitle}
          description="섹션의 목적을 설명하는 보조 정보예요."
        />
        <MobileList aria-label="여행안 후보">
          <MobileListItem>
            <ItemTitle>
              <h3>{cardTitle}</h3>
            </ItemTitle>
          </MobileListItem>
        </MobileList>
      </>,
    );

    const headings = screen.getAllByRole("heading");
    const h1 = screen.getByRole("heading", { level: 1, name: pageTitle });
    const h2 = screen.getByRole("heading", { level: 2, name: sectionTitle });
    const h3 = screen.getByRole("heading", { level: 3, name: cardTitle });

    expect(headings).toEqual([h1, h2, h3]);
    expect(h1.className).toContain("[overflow-wrap:anywhere]");
    expect(h2.className).toContain("[overflow-wrap:anywhere]");
    expect(h1).toBeVisible();
    expect(h2).toBeVisible();
    expect(h3).toBeVisible();
    expect(
      screen.getByText("화면 설명도 생략되거나 접근성 트리에서 숨겨지지 않아요."),
    ).toBeVisible();
    expect(
      screen.getByText("섹션의 목적을 설명하는 보조 정보예요."),
    ).toBeVisible();
  });
});
