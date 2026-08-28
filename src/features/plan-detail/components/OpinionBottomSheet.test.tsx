// @vitest-environment jsdom
import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpinionBottomSheet } from "./OpinionBottomSheet.tsx";

function pageScrollIsLocked(): boolean {
  return [document.documentElement, document.body].some(
    (element) =>
      element.style.overflow === "hidden" ||
      element.style.overflowX === "hidden" ||
      element.style.overflowY === "hidden",
  );
}

function OpinionSheetHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        의견 남기기 열기
      </button>
      <OpinionBottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={vi.fn()}
      />
      <button type="button">배경 행동</button>
    </>
  );
}

describe("OpinionBottomSheet accessibility and state contracts", () => {
  it("dialog 이름·설명을 제공하고 focus/scroll을 가둔 뒤 Escape에서 opener로 복원한다", async () => {
    render(<OpinionSheetHarness />);

    const opener = screen.getByRole("button", { name: "의견 남기기 열기" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", {
      name: "이 여행안은 어때요?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "내 의견은 언제든 바꿀 수 있어요.",
    );
    expect(
      within(dialog).getByRole("radiogroup", {
        name: "이 여행안에 대한 내 의견",
      }),
    ).toBeInTheDocument();

    await waitFor(() => expect(pageScrollIsLocked()).toBe(true));
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "이 여행안은 어때요?" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    await waitFor(() => expect(pageScrollIsLocked()).toBe(false));
  });

  it("영구 label과 validation을 유지하고 pending/error에서도 입력을 보존한다", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <OpinionBottomSheet
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "이 여행안은 어때요?",
    });
    const saveButton = within(dialog).getByRole("button", {
      name: "의견 저장하기",
    });
    expect(saveButton).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("radio", { name: "어려워요" }));
    const reasonInput = within(dialog).getByLabelText("어려운 이유");
    expect(reasonInput).toHaveAttribute(
      "placeholder",
      "예: 예산, 숙소 위치, 이동 시간 등",
    );
    expect(saveButton).toBeDisabled();

    const reason =
      "가격과 이동 시간이 길어서 다시 확인해야 하는 매우 긴 의견입니다.";
    fireEvent.change(reasonInput, { target: { value: reason } });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("HARD", reason);

    view.rerender(
      <OpinionBottomSheet
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting
        errorMessage="의견을 저장하지 못했습니다. 다시 시도해주세요."
      />,
    );

    const pendingButton = within(dialog).getByRole("button", {
      name: "저장 중...",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByLabelText("어려운 이유")).toHaveValue(reason);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "의견을 저장하지 못했습니다. 다시 시도해주세요.",
    );

    fireEvent.click(pendingButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
