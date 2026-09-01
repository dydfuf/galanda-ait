import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER } from "../fixtures/auth.ts";

test.describe("Offline Detection and Draft Preservation E2E", () => {
  test("네트워크 단절 시 오프라인 배너가 표시되고 온라인 복귀 시 정상화된다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(browser, HOST_USER, origin);

    try {
      await page.goto(`${origin}/trips`);
      await page.waitForLoadState("domcontentloaded");

      // 1. 오프라인 모드 전환
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));

      // 2. 오프라인 배너 노출 확인
      await expect(page.getByRole("status")).toBeVisible();
      await expect(page.getByText(/오프라인 상태입니다/)).toBeVisible();

      // 3. 온라인 모드 복귀
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));

      // 4. 오프라인 배너 사라짐 확인
      await expect(page.getByRole("status")).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
});
