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

  it("keeps sticky headers working by clipping horizontal overflow instead of hiding it", () => {
    // overflow-x: hidden은 조상을 scroll container로 만들어 sticky가 viewport가
    // 아니라 늘어난 조상 기준으로 고정되게 해요. 가로 넘침만 막는 clip을 써요.
    expect(indexCss).toMatch(/overflow-x:\s*clip;/);
    expect(indexCss).not.toMatch(/overflow-x:\s*hidden;/);
    const appRootSource = readFileSync(
      path.resolve(process.cwd(), "src/app/layouts/AppRootLayout.tsx"),
      "utf8",
    );
    expect(appRootSource).toMatch(/overflow-x:\s*clip;/);
    expect(appRootSource).not.toMatch(/overflow-x:\s*hidden;/);
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

  it("centers PageBody and reserves the larger of its fallback or measured CTA clearance", () => {
    const dynamicClearance =
      "pb-[max(var(--app-cta-space),calc(var(--app-bottom-action-height,0px)+16px))]";
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
    expect(body.className).toContain(dynamicClearance);
    expect(body.className).not.toContain("scroll-pb-");
    expect(body.className).not.toContain("pb-(--app-page-padding-bottom)");
    expect(indexCss).toMatch(/--app-keyboard-inset:\s*0px;/);
    // 고정 UI 공간은 scroller의 scroll-padding에서 한 번만 예약해요.
    // PageHeader 본체 h-14(56px) + safe-top, 하단은 실측 CTA 높이 + 키보드예요.
    expect(indexCss).toMatch(/scroll-padding-top:\s*calc\(56px \+ var\(--safe-top\)\)/);
    expect(indexCss).toMatch(/scroll-padding-bottom:\s*calc\(\s*var\(--app-bottom-action-height/);
    expect(indexCss).toMatch(/var\(--app-keyboard-inset/);
    // 대상의 scroll-margin은 작은 시각적 여백만 둬요(이중 예약 금지).
    expect(indexCss).toMatch(/scroll-margin-top:\s*8px;/);
    expect(indexCss).toMatch(/scroll-margin-bottom:\s*16px;/);
    // BottomAction 실측 높이에 safe-area가 포함되므로 scroll-padding에 중복 가산하지 않아요.
    expect(indexCss).not.toMatch(/scroll-padding-bottom:[^}]*var\(--safe-bottom\)/);
    expect(
      screen.getByRole("button", { name: "마지막 본문 행동" }),
    ).toBeInTheDocument();

    rerender(<PageBody data-testid="page-body" />);

    body = screen.getByTestId("page-body");
    expect(body.className).toContain("pb-(--app-page-padding-bottom)");
    expect(body.className).not.toContain(dynamicClearance);
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
    expect(actionChrome).toHaveAttribute("data-slot", "bottom-action");
    expect(actionChrome?.className).toContain("fixed");
    expect(actionChrome?.className).toContain("inset-x-0");
    expect(actionChrome).toHaveStyle({
      bottom:
        "calc(var(--global-nav-height, 0px) + var(--app-keyboard-inset, 0px))",
      paddingBottom:
        "calc(12px + var(--bottom-action-safe-bottom, var(--safe-bottom)))",
    });
    expect(actionChrome?.className).toContain("transition-[bottom]");
    expect(actionChrome?.className).toContain("border-t");

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

  it("publishes a static document fallback when ResizeObserver is unavailable", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "ResizeObserver",
    );
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      const { unmount } = render(
        <BottomAction accessory={<p>두 줄 이상의 안내 메시지</p>}>
          <Button>계속</Button>
        </BottomAction>,
      );

      expect(
        document.documentElement.style.getPropertyValue(
          "--app-bottom-action-height",
        ),
      ).toBe("var(--app-cta-space)");

      unmount();
      expect(
        document.documentElement.style.getPropertyValue(
          "--app-bottom-action-height",
        ),
      ).toBe("");
    } finally {
      document.documentElement.style.removeProperty(
        "--app-bottom-action-height",
      );
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "ResizeObserver");
      }
    }
  });

  it("publishes legacy and modern observer heights and clears them on unmount", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "ResizeObserver",
    );
    let resizeCallback: ResizeObserverCallback | undefined;
    let observedElement: Element | undefined;
    let disconnected = false;

    class ResizeObserverMock implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(target: Element) {
        observedElement = target;
      }

      unobserve() {}

      disconnect() {
        disconnected = true;
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });

    try {
      const { container, unmount } = render(
        <BottomAction
          accessory={
            <p>
              다른 사용자의 변경 사항을 반영했습니다. 내용을 다시 확인한 뒤
              저장해 주세요.
            </p>
          }
        >
          <Button>다시 저장</Button>
        </BottomAction>,
      );
      const actionChrome = container.querySelector<HTMLElement>(
        '[data-galanda-surface="chrome"]',
      );

      expect(observedElement).toBe(actionChrome);
      Object.defineProperty(actionChrome, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ height: 152 }) as DOMRect,
      });
      resizeCallback?.(
        [
          {
            borderBoxSize: undefined,
          } as unknown as ResizeObserverEntry,
        ],
        undefined as unknown as ResizeObserver,
      );
      expect(
        document.documentElement.style.getPropertyValue(
          "--app-bottom-action-height",
        ),
      ).toBe("152px");

      resizeCallback?.(
        [
          {
            borderBoxSize: [{ blockSize: 184, inlineSize: 320 }],
          } as unknown as ResizeObserverEntry,
        ],
        undefined as unknown as ResizeObserver,
      );
      expect(
        document.documentElement.style.getPropertyValue(
          "--app-bottom-action-height",
        ),
      ).toBe("184px");

      unmount();
      expect(disconnected).toBe(true);
      expect(
        document.documentElement.style.getPropertyValue(
          "--app-bottom-action-height",
        ),
      ).toBe("");
    } finally {
      document.documentElement.style.removeProperty(
        "--app-bottom-action-height",
      );
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "ResizeObserver");
      }
    }
  });
});
