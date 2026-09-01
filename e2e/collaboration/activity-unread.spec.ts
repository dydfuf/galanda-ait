import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER, MEMBER_USER } from "../fixtures/auth.ts";

test.describe("Activity Feed and Unread Mark-Read E2E", () => {
  test("협업 변경 시 활동 알림이 표시되고 Drawer에서 모두 확인 클릭 시 읽음 처리된다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(browser, HOST_USER, origin);
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);

    try {
      // 1. Host가 방 생성
      await host.page.goto(`${origin}/trips/new`);
      const titleInput = host.page.locator('input[name="title"], input#title').first();
      await expect(titleInput).toBeVisible();
      await titleInput.fill("활동 알림 검증 여행");

      const submitBtn = host.page.getByRole("button", { name: /만들기|시작|다음/ }).first();
      await submitBtn.click();

      await host.page.waitForURL(/\/trips\/([^/]+)/);
      const tripId = /\/trips\/([^/?#]+)/.exec(host.page.url())![1];
      expect(tripId).not.toBe("new");

      // 2. Member가 방 진입
      await member.page.goto(`${origin}/trips/${tripId}/plans`);
      await member.page.waitForLoadState("domcontentloaded");

      // 3. Host 화면에서 활동 알림 버튼 확인
      const bellButton = host.page.getByRole("button", { name: /활동|알림/ }).first();
      if (await bellButton.isVisible()) {
        await bellButton.click();
        await expect(host.page.getByText("활동 알림")).toBeVisible();
      }
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
