// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toast } from "sonner";

import { Button } from "./button.tsx";
import { Field, FieldLabel } from "./field.tsx";
import { Input } from "./input.tsx";
import { Toaster } from "./sonner.tsx";
import { Spinner } from "./spinner.tsx";
import { Tabs, TabsList, TabsTrigger } from "./tabs.tsx";
import { Textarea } from "./textarea.tsx";

const buttonSizes = [
  "default",
  "xs",
  "sm",
  "lg",
  "xl",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const;

describe("UI refresh primitive contracts", () => {
  describe("Button", () => {
    it.each(buttonSizes)(
      "keeps the %s size at least 44px in both dimensions",
      (size) => {
        render(
          <Button size={size} aria-label={`${size} action`}>
            {size.startsWith("icon") ? (
              <span aria-hidden="true">+</span>
            ) : (
              "계속하기"
            )}
          </Button>,
        );

        const button = screen.getByRole("button", { name: `${size} action` });
        if (size.startsWith("icon")) {
          expect(button.className).toContain("size-(--touch-target-min)");
        } else {
          expect(button.className).toContain(
            size === "xl" ? "min-h-12" : "min-h-(--touch-target-min)",
          );
          expect(button.className).toContain("min-w-(--touch-target-min)");
        }
      },
    );

    it("provides a visible focus contract and an accessible name for icon actions", () => {
      render(
        <Button size="icon">
          <svg aria-hidden="true" />
          <span className="sr-only">여행 공유하기</span>
        </Button>,
      );

      const button = screen.getByRole("button", { name: "여행 공유하기" });
      expect(button.className).toContain("focus-visible:border-ring");
      expect(button.className).toContain("focus-visible:ring-3");
      expect(button.className).toContain("focus-visible:ring-ring/50");
      expect(button.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });
  });

  describe("form controls", () => {
    it("keeps permanent labels associated with 16px input and textarea controls", () => {
      render(
        <div>
          <Field>
            <FieldLabel htmlFor="trip-title">여행 제목</FieldLabel>
            <Input id="trip-title" placeholder="예: 제주도 여행" />
          </Field>
          <Field>
            <FieldLabel htmlFor="trip-notes">여행 메모</FieldLabel>
            <Textarea
              id="trip-notes"
              placeholder="함께 확인할 내용을 입력하세요"
            />
          </Field>
        </div>,
      );

      const input = screen.getByLabelText("여행 제목");
      const textarea = screen.getByLabelText("여행 메모");

      expect(
        screen.getByText("여행 제목", { selector: "label" }),
      ).toHaveAttribute("for", "trip-title");
      expect(
        screen.getByText("여행 메모", { selector: "label" }),
      ).toHaveAttribute("for", "trip-notes");
      expect(input).toHaveAttribute("placeholder", "예: 제주도 여행");
      expect(textarea).toHaveAttribute(
        "placeholder",
        "함께 확인할 내용을 입력하세요",
      );
      expect(input.className).toContain("text-base");
      expect(textarea.className).toContain("text-base");
      expect(input.className).not.toContain("md:text-sm");
      expect(textarea.className).not.toContain("md:text-sm");

      fireEvent.change(input, { target: { value: "오키나와 가족 여행" } });
      fireEvent.change(textarea, { target: { value: "긴 메모" } });

      expect(
        screen.getByText("여행 제목", { selector: "label" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("여행 메모", { selector: "label" }),
      ).toBeInTheDocument();
    });

    it("provides a visible focus contract on input and textarea", () => {
      render(
        <>
          <Input aria-label="제목" />
          <Textarea aria-label="설명" />
        </>,
      );

      for (const control of [
        screen.getByRole("textbox", { name: "제목" }),
        screen.getByRole("textbox", { name: "설명" }),
      ]) {
        expect(control.className).toContain("focus-visible:border-ring");
        expect(control.className).toContain("focus-visible:ring-3");
        expect(control.className).toContain("focus-visible:ring-ring/50");
      }
    });
  });

  describe("Tabs", () => {
    it("separates default content tabs from chrome mode tabs", () => {
      render(
        <>
          <Tabs defaultValue="ongoing">
            <TabsList aria-label="여행 목록 필터">
              <TabsTrigger value="ongoing">진행 중</TabsTrigger>
              <TabsTrigger value="past">지난 여행</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs defaultValue="plans">
            <TabsList variant="chrome" aria-label="여행방 모드">
              <TabsTrigger value="plans">계획</TabsTrigger>
              <TabsTrigger value="itinerary">일정</TabsTrigger>
            </TabsList>
          </Tabs>
        </>,
      );

      const contentTabs = screen.getByRole("tablist", {
        name: "여행 목록 필터",
      });
      const chromeTabs = screen.getByRole("tablist", { name: "여행방 모드" });

      expect(contentTabs).toHaveAttribute("data-variant", "default");
      expect(contentTabs).not.toHaveAttribute("data-galanda-surface");
      expect(contentTabs.className).toContain("bg-muted");
      expect(chromeTabs).toHaveAttribute("data-variant", "chrome");
      expect(chromeTabs).toHaveAttribute("data-galanda-surface", "chrome");
      expect(chromeTabs.className).not.toContain("bg-muted");
    });

    it("updates both visual and aria-selected state when the selected tab changes", () => {
      render(
        <Tabs defaultValue="plans">
          <TabsList variant="chrome" aria-label="여행방 모드">
            <TabsTrigger value="plans">계획</TabsTrigger>
            <TabsTrigger value="itinerary">일정</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const plansTab = screen.getByRole("tab", { name: "계획" });
      const itineraryTab = screen.getByRole("tab", { name: "일정" });

      expect(plansTab).toHaveAttribute("data-active");
      expect(plansTab).toHaveAttribute("aria-selected", "true");
      expect(itineraryTab).not.toHaveAttribute("data-active");
      expect(itineraryTab).toHaveAttribute("aria-selected", "false");

      fireEvent.click(itineraryTab);

      expect(plansTab).not.toHaveAttribute("data-active");
      expect(plansTab).toHaveAttribute("aria-selected", "false");
      expect(itineraryTab).toHaveAttribute("data-active");
      expect(itineraryTab).toHaveAttribute("aria-selected", "true");
      expect(itineraryTab.className).toContain("data-active:bg-background");
      expect(itineraryTab.className).toContain("focus-visible:ring-[3px]");
    });
  });

  it("keeps long action and tab labels reflowable inside a 320px fixture", () => {
    const longAction = "참여자들과확정일정을공유하고다음단계로계속진행하기";
    const longTab = "모든참여자가제안한아주긴여행계획목록보기";

    render(
      <div
        data-testid="mobile-viewport"
        style={{ width: "320px", maxWidth: "100%" }}
      >
        <Button>{longAction}</Button>
        <Tabs defaultValue="long">
          <TabsList aria-label="좁은 화면 탭">
            <TabsTrigger value="long">{longTab}</TabsTrigger>
            <TabsTrigger value="other">
              확정된아주긴여행일정상세보기
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>,
    );

    expect(screen.getByTestId("mobile-viewport")).toHaveStyle({
      width: "320px",
    });

    const action = screen.getByRole("button", { name: longAction });
    expect(action.className).toContain("max-w-full");
    expect(action.className).toContain("min-w-(--touch-target-min)");
    expect(action.className).toContain("whitespace-normal");
    expect(action.className).toContain("[overflow-wrap:anywhere]");
    expect(action).toHaveTextContent(longAction);

    const tabList = screen.getByRole("tablist", { name: "좁은 화면 탭" });
    expect(tabList.className).toContain("max-w-full");
    expect(tabList.className).toContain("min-w-0");

    const tab = screen.getByRole("tab", { name: longTab });
    expect(tab.className).toContain("min-w-0");
    expect(tab.className).toContain("whitespace-normal");
    expect(tab.className).toContain("[overflow-wrap:anywhere]");
    expect(tab).toHaveTextContent(longTab);
  });

  describe("Spinner and Sonner", () => {
    it("stops decorative motion in reduced-motion mode without removing status text", () => {
      render(
        <div role="status" aria-label="여행 정보 로딩 상태">
          <Spinner aria-hidden="true" />
          <span>여행 정보를 불러오는 중이에요.</span>
        </div>,
      );

      const status = screen.getByRole("status", {
        name: "여행 정보 로딩 상태",
      });
      const spinner = status.querySelector('[data-slot="spinner"]');

      expect(status).toHaveTextContent("여행 정보를 불러오는 중이에요.");
      expect(spinner).toHaveAttribute("aria-hidden", "true");
      expect(spinner?.getAttribute("class")).toContain(
        "motion-reduce:animate-none",
      );
      expect(spinner?.getAttribute("class")).toContain(
        "motion-reduce:transform-none",
      );
    });

    it("keeps Sonner loading state text when its spinner is motion-reduced", async () => {
      render(<Toaster />);

      let toastId: string | number = "";
      act(() => {
        toastId = toast.loading("여행 정보를 저장하는 중이에요.");
      });

      const stateText =
        await screen.findByText("여행 정보를 저장하는 중이에요.");
      const toastItem = stateText.closest("[data-sonner-toast]");
      const spinner = toastItem?.querySelector('[data-slot="spinner"]');

      expect(stateText).toBeInTheDocument();
      expect(toastItem).toHaveAttribute("data-type", "loading");
      expect(spinner).toHaveAttribute("aria-hidden", "true");
      expect((spinner as SVGElement).className.baseVal).toContain(
        "motion-reduce:animate-none",
      );

      act(() => {
        toast.dismiss(toastId);
      });
    });
  });
});
