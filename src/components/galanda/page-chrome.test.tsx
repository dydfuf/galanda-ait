// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

import { BottomAction } from "./bottom-action.tsx";
import { PageBody } from "./page-body.tsx";
import { PageHeader } from "./page-header.tsx";

const indexCss = readFileSync(
  path.resolve(process.cwd(), "src/index.css"),
  "utf8",
);

function countOccurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

describe("Page chrome geometry contracts", () => {
  it("keeps a sticky header distinguishable and reserves 44px action slots around a 720px inner column", () => {
    const { container } = render(
      <PageHeader
        sticky
        bordered
        title="여행방"
        back={{ onClick: () => undefined }}
        action={
          <Button size="icon" aria-label="여행 공유하기">
            <span aria-hidden="true">+</span>
          </Button>
        }
      />,
    );

    const header = container.querySelector("header");
    expect(header).toHaveAttribute("data-galanda-surface", "chrome");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(header?.className).toContain("border-b");

    const innerColumn = header?.firstElementChild as HTMLElement;
    expect(indexCss).toMatch(/--content-max-width:\s*720px;/);
    expect(indexCss).toMatch(/--touch-target-min:\s*44px;/);
    expect(innerColumn.className).toContain("mx-auto");
    expect(innerColumn.className).toContain("w-full");
    expect(innerColumn.className).toContain("max-w-(--content-max-width)");
    expect(innerColumn.className).toContain(
      "grid-cols-[minmax(var(--touch-target-min),1fr)_minmax(0,auto)_minmax(var(--touch-target-min),1fr)]",
    );

    const [leftSlot, titleSlot, rightSlot] = Array.from(
      innerColumn.children,
    ) as HTMLElement[];
    expect(leftSlot.className).toContain("min-w-(--touch-target-min)");
    expect(rightSlot.className).toContain("min-w-(--touch-target-min)");
    expect(leftSlot).toContainElement(
      screen.getByRole("button", { name: "뒤로 가기" }),
    );
    expect(rightSlot).toContainElement(
      screen.getByRole("button", { name: "여행 공유하기" }),
    );
    expect(titleSlot).toHaveTextContent("여행방");
    expect(
      screen.queryByRole("heading", { name: "여행방" }),
    ).not.toBeInTheDocument();
  });

  it("applies Web safe-top only when an explicit native top inset is absent", () => {
    const { container, rerender } = render(<PageHeader title="여행 만들기" />);

    let header = container.querySelector("header");
    expect(header?.className).toContain("pt-(--safe-top)");
    expect(header).not.toHaveStyle({ paddingTop: "64px" });

    rerender(<PageHeader title="여행방" safeTop topInset={64} />);

    header = container.querySelector("header");
    expect(header?.className).not.toContain("pt-(--safe-top)");
    expect(header).toHaveStyle({ paddingTop: "64px" });
  });

  it("centers PageBody in the 720px content column and reserves scrollable CTA clearance", () => {
    const { rerender } = render(
      <PageBody data-testid="page-body" withBottomAction>
        <button type="button">마지막 본문 행동</button>
      </PageBody>,
    );

    let body = screen.getByTestId("page-body");
    expect(body).toHaveAttribute("data-galanda-surface", "content");
    expect(body.className).toContain("mx-auto");
    expect(body.className).toContain("w-full");
    expect(body.className).toContain("max-w-(--content-max-width)");
    expect(body.className).toContain("pb-(--app-cta-space)");
    expect(body.className).toContain("scroll-pb-(--app-cta-space)");
    expect(body.className).not.toContain("pb-(--app-page-padding-bottom)");
    expect(
      screen.getByRole("button", { name: "마지막 본문 행동" }),
    ).toBeInTheDocument();

    rerender(<PageBody data-testid="page-body" />);

    body = screen.getByTestId("page-body");
    expect(body.className).toContain("pb-(--app-page-padding-bottom)");
    expect(body.className).not.toContain("pb-(--app-cta-space)");
    expect(body.className).not.toContain("scroll-pb-(--app-cta-space)");
  });

  it("fixes BottomAction to the viewport and places its accessory above the actions with one safe-bottom application", () => {
    const { container } = render(
      <BottomAction accessory={<p>제목을 입력해 주세요.</p>}>
        <Button>여행 만들기</Button>
      </BottomAction>,
    );

    const actionChrome = container.querySelector<HTMLElement>(
      '[data-galanda-surface="chrome"]',
    );
    expect(actionChrome).toBeInTheDocument();
    expect(actionChrome?.className).toContain("fixed");
    expect(actionChrome?.className).toContain("inset-x-0");
    expect(actionChrome?.className).toContain("bottom-0");
    expect(actionChrome?.className).toContain("border-t");
    expect(actionChrome?.className).toContain(
      "pb-[calc(12px+var(--safe-bottom))]",
    );

    const innerColumn = actionChrome?.firstElementChild as HTMLElement;
    expect(innerColumn.className).toContain("mx-auto");
    expect(innerColumn.className).toContain("w-full");
    expect(innerColumn.className).toContain("max-w-(--content-max-width)");

    const [accessorySlot, actionSlot] = Array.from(
      innerColumn.children,
    ) as HTMLElement[];
    expect(accessorySlot).toHaveTextContent("제목을 입력해 주세요.");
    expect(actionSlot).toContainElement(
      screen.getByRole("button", { name: "여행 만들기" }),
    );
    expect(accessorySlot.compareDocumentPosition(actionSlot)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    expect(countOccurrences(container.innerHTML, "var(--safe-bottom)")).toBe(1);
  });
});
