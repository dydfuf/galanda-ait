// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WizardStepPage } from "./wizard-step-page.tsx";

describe("WizardStepPage", () => {
  const progress = {
    currentStep: "plan-basic" as const,
    subStepLabel: "기본 정보",
    subStepProgress: { current: 1, total: 13 },
  };

  it("owns one primary CTA, optional secondary CTA, and bottom clearance", () => {
    render(
      <WizardStepPage
        title="여행안의 이름을 지어주세요"
        description="설명"
        progress={progress}
        draftStatus={{ label: "아직 저장되지 않음", tone: "neutral" }}
        primaryAction={{ label: "다음", event: "next", state: { tag: "enabled" } }}
        secondaryAction={{ label: "이전", event: "previous", state: { tag: "enabled" } }}
        onAction={() => undefined}
      >
        <p>질문 내용</p>
      </WizardStepPage>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("질문 내용")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-step-page-body")).toHaveClass(
      "pb-[calc(max(var(--app-cta-space),calc(var(--app-bottom-action-height,0px)+16px))+var(--app-keyboard-inset,0px))]",
    );
  });

  it("exposes a typed disabled reason without letting a disabled CTA fire", () => {
    render(
      <WizardStepPage
        title="제목"
        description="설명"
        progress={{ currentStep: "plan-basic", subStepLabel: "기본 정보" }}
        draftStatus={{ label: "임시 저장하지 못했어요", tone: "error" }}
        primaryAction={{
          label: "다음",
          event: "next",
          state: { tag: "disabled", reason: "제목을 입력해주세요." },
        }}
        onAction={() => undefined}
      >
        <p>질문 내용</p>
      </WizardStepPage>,
    );

    const button = screen.getByRole("button", { name: "다음" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "제목을 입력해주세요.");
    expect(screen.getByRole("status")).toHaveTextContent("임시 저장하지 못했어요");
  });
});
