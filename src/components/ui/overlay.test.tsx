// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer.tsx";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const drawerSource = readFileSync(
  path.join(currentDirectory, "drawer.tsx"),
  "utf8",
);
const alertDialogSource = readFileSync(
  path.join(currentDirectory, "alert-dialog.tsx"),
  "utf8",
);
const indexCss = readFileSync(
  path.resolve(currentDirectory, "../../index.css"),
  "utf8",
);

function extractCssBlock(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`CSS marker not found: ${marker}`);
  }

  const openingBraceIndex = source.indexOf("{", markerIndex + marker.length);
  if (openingBraceIndex === -1) {
    throw new Error(`Opening brace not found after CSS marker: ${marker}`);
  }

  let depth = 0;
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBraceIndex + 1, index);
      }
    }
  }

  throw new Error(`Closing brace not found after CSS marker: ${marker}`);
}

function pageScrollIsLocked(): boolean {
  return [document.documentElement, document.body].some(
    (element) =>
      element.style.overflow === "hidden" ||
      element.style.overflowX === "hidden" ||
      element.style.overflowY === "hidden",
  );
}

function DrawerFixture() {
  return (
    <>
      <Drawer>
        <DrawerTrigger>여행안 선택 열기</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>여행안 선택</DrawerTitle>
            <DrawerDescription>
              비교할 여행안을 선택해 주세요.
            </DrawerDescription>
          </DrawerHeader>
          <label htmlFor="drawer-search">여행안 검색</label>
          <input id="drawer-search" />
          <DrawerFooter>
            <button type="button">선택 완료</button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <button type="button">배경 행동</button>
    </>
  );
}

function AlertDialogFixture() {
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger>여행안 삭제 열기</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>여행안을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 이 여행안을 다시 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <button type="button">배경 링크</button>
    </>
  );
}

function StatefulAlertDialogFixture() {
  const [state, setState] = React.useState<"idle" | "pending" | "error">(
    "idle",
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger>저장 확인 열기</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>변경 내용을 저장할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            서버가 저장을 확인할 때까지 이 창을 유지합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state === "pending" && <output>저장 중입니다.</output>}
        {state === "error" && (
          <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          {state === "pending" ? (
            <button type="button" onClick={() => setState("error")}>
              실패 응답 반영
            </button>
          ) : (
            <AlertDialogAction onClick={() => setState("pending")}>
              저장
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
});

describe("Drawer accessibility and state contracts", () => {
  it("exposes its dialog name and description, traps focus, locks scroll, and restores the opener after Escape", async () => {
    render(<DrawerFixture />);

    const opener = screen.getByRole("button", { name: "여행안 선택 열기" });
    const backgroundAction = screen.getByRole("button", { name: "배경 행동" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "여행안 선택" });
    expect(dialog).toHaveAccessibleDescription(
      "비교할 여행안을 선택해 주세요.",
    );
    expect(within(dialog).getByLabelText("여행안 검색")).toBeInTheDocument();

    await waitFor(() => expect(pageScrollIsLocked()).toBe(true));
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );

    const inertBoundary = backgroundAction.parentElement;
    expect(inertBoundary).toHaveAttribute("aria-hidden", "true");
    expect(inertBoundary).toHaveAttribute("data-base-ui-inert");

    const focusGuards = document.querySelectorAll<HTMLElement>(
      '[data-base-ui-focus-guard][data-type="inside"]',
    );
    expect(focusGuards.length).toBeGreaterThanOrEqual(2);
    focusGuards[focusGuards.length - 1].focus();
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "여행안 선택" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    await waitFor(() => expect(pageScrollIsLocked()).toBe(false));
  });

  it("keeps keyboard-aware safe-area and virtual-keyboard footer contracts", async () => {
    render(
      <Drawer keyboardAware>
        <DrawerTrigger>입력 drawer 열기</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>여행안 의견</DrawerTitle>
            <DrawerDescription>의견을 입력해 주세요.</DrawerDescription>
          </DrawerHeader>
          <textarea aria-label="의견" />
          <DrawerFooter data-testid="keyboard-aware-footer">
            <button type="button">저장</button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "입력 drawer 열기" }));
    await screen.findByRole("dialog", { name: "여행안 의견" });

    expect(screen.getByTestId("keyboard-aware-footer").className).toContain(
      "var(--drawer-keyboard-inset,0px)",
    );
    expect(screen.getByTestId("keyboard-aware-footer").className).toContain(
      "var(--safe-bottom,0px)",
    );
    expect(drawerSource).toContain(
      "<DrawerPrimitive.VirtualKeyboardProvider>{content}</DrawerPrimitive.VirtualKeyboardProvider>",
    );
  });
});

describe("AlertDialog accessibility and state contracts", () => {
  it("exposes alertdialog semantics, traps focus, locks scroll, and restores the opener after Escape", async () => {
    render(<AlertDialogFixture />);

    const opener = screen.getByRole("button", { name: "여행안 삭제 열기" });
    const backgroundAction = screen.getByRole("button", { name: "배경 링크" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("alertdialog", {
      name: "여행안을 삭제할까요?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "삭제하면 이 여행안을 다시 복구할 수 없습니다.",
    );
    expect(
      within(dialog).getByRole("button", { name: "취소" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "삭제" }),
    ).toBeInTheDocument();

    await waitFor(() => expect(pageScrollIsLocked()).toBe(true));
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );

    const inertBoundary = backgroundAction.parentElement;
    expect(inertBoundary).toHaveAttribute("aria-hidden", "true");
    expect(inertBoundary).toHaveAttribute("data-base-ui-inert");

    const focusGuards = document.querySelectorAll<HTMLElement>(
      '[data-base-ui-focus-guard][data-type="inside"]',
    );
    expect(focusGuards.length).toBeGreaterThanOrEqual(2);
    focusGuards[focusGuards.length - 1].focus();
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", {
          name: "여행안을 삭제할까요?",
        }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    await waitFor(() => expect(pageScrollIsLocked()).toBe(false));
  });

  it("keeps pending and failure announcements inside the open dialog", async () => {
    render(<StatefulAlertDialogFixture />);

    fireEvent.click(screen.getByRole("button", { name: "저장 확인 열기" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "변경 내용을 저장할까요?",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "저장 중입니다.",
    );
    expect(dialog).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "실패 응답 반영" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "저장하지 못했습니다. 다시 시도해 주세요.",
    );
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByText("저장됨")).not.toBeInTheDocument();
  });
});

describe("Overlay glass fallback and motion source contracts", () => {
  it("uses the owned overlay selector with an opaque-first fallback", () => {
    const rootBlock = extractCssBlock(indexCss, ":root");
    const supportsBlock = extractCssBlock(indexCss, "@supports");
    const overlayBlock = extractCssBlock(
      indexCss,
      '[data-galanda-surface="overlay"]',
    );

    expect(rootBlock).toMatch(
      /--surface-overlay:\s*var\(--surface-overlay-opaque\)\s*;/,
    );
    expect(rootBlock).toMatch(/--overlay-backdrop-filter:\s*none\s*;/);
    expect(supportsBlock).toMatch(
      /--surface-overlay:\s*var\(--surface-overlay-glass\)\s*;/,
    );
    expect(supportsBlock).toMatch(
      /--overlay-backdrop-filter:\s*blur\(var\(--blur-overlay\)\)\s+saturate\(var\(--saturation-chrome\)\)\s*;/,
    );
    expect(overlayBlock).toMatch(
      /background-color:\s*var\(--surface-overlay\)\s*;/,
    );
    expect(overlayBlock).toMatch(/border-color:\s*var\(--border-overlay\)\s*;/);

    for (const source of [drawerSource, alertDialogSource]) {
      expect(source).toContain('data-galanda-surface="overlay"');
      expect(source).toContain(
        "[backdrop-filter:var(--overlay-backdrop-filter)]",
      );
    }
    expect(drawerSource).toContain('data-galanda-surface="content"');
    expect(drawerSource).toContain(
      "after:bg-(--drawer-bleed-background,var(--surface-overlay-opaque))",
    );
  });

  it("caps overlay transitions at 300ms", () => {
    const tokenDurations = new Map<string, number>();
    for (const match of indexCss.matchAll(
      /(--motion-duration-[\w-]+):\s*(\d+)ms\s*;/g,
    )) {
      tokenDurations.set(match[1], Number(match[2]));
    }

    const violations: string[] = [];
    for (const [name, source] of [
      ["drawer.tsx", drawerSource],
      ["alert-dialog.tsx", alertDialogSource],
    ] as const) {
      for (const match of source.matchAll(/(?:^|[^\w-])duration-(\d+)\b/g)) {
        if (Number(match[1]) > 300) {
          violations.push(`${name}: duration-${match[1]}`);
        }
      }
      for (const match of source.matchAll(
        /duration-\[var\((--motion-duration-[\w-]+)\)\]/g,
      )) {
        const duration = tokenDurations.get(match[1]);
        if (duration === undefined || duration > 300) {
          violations.push(`${name}: ${match[1]}=${String(duration)}ms`);
        }
      }
    }

    expect(
      tokenDurations.get("--motion-duration-standard"),
    ).toBeLessThanOrEqual(300);
    expect(tokenDurations.get("--motion-duration-overlay")).toBeLessThanOrEqual(
      300,
    );
    expect(violations).toEqual([]);
  });

  it("switches overlay motion to the instant token in reduced-motion mode", () => {
    const rootBlock = extractCssBlock(indexCss, ":root");
    const reducedMotionBlock = extractCssBlock(
      indexCss,
      "@media (prefers-reduced-motion: reduce)",
    );

    expect(rootBlock).toMatch(/--motion-duration-instant:\s*0ms\s*;/);
    expect(reducedMotionBlock).toMatch(
      /--motion-duration-standard:\s*var\(--motion-duration-instant\)\s*;/,
    );
    expect(reducedMotionBlock).toMatch(
      /--motion-duration-overlay:\s*var\(--motion-duration-instant\)\s*;/,
    );
    expect(reducedMotionBlock).toMatch(
      /transition-duration:\s*var\(--motion-duration-instant\)\s*!important\s*;/,
    );

    expect(drawerSource).toContain("motion-reduce:transition-none");
    expect(alertDialogSource).toContain("motion-reduce:transition-none");
    expect(alertDialogSource).toContain("motion-reduce:animate-none");
  });
});
