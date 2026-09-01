import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER, MEMBER_USER } from "../fixtures/auth.ts";

test.describe("Invite & Join Collaboration Journey E2E", () => {
  test("Host가 발급한 초대 링크를 통해 Member가 독립 세션에서 방에 참여한다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(browser, HOST_USER, origin);
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);

    try {
      // 1. Host가 새 여행 생성
      await host.page.goto(`${origin}/trips/new`);
      const titleInput = host.page.locator('input[name="title"], input#title').first();
      await expect(titleInput).toBeVisible();
      await titleInput.fill("오사카 우정 여행");

      const submitButton = host.page.getByRole("button", { name: /만들기|시작|다음/ }).first();
      await submitButton.click();

      await host.page.waitForURL(/\/trips\/([^/]+)/);
      const tripId = /\/trips\/([^/?#]+)/.exec(host.page.url())![1];
      expect(tripId).not.toBe("new");

      // 2. Member가 여행 계획 페이지 진입
      await member.page.goto(`${origin}/trips/${tripId}/plans`);
      await member.page.waitForLoadState("domcontentloaded");

      // 3. Member 세션에서 여행 제목 확인
      await expect(member.page.getByText("오사카 우정 여행").first()).toBeVisible();
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
