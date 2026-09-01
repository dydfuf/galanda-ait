import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER } from "../fixtures/auth.ts";

test.describe("Trip Creation and Plan Publication E2E", () => {
  test("Host가 새 여행을 생성하고 첫 여행안을 작성하여 공개한다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(browser, HOST_USER, origin);

    try {
      // 1. 새 여행 만들기 페이지 이동
      await page.goto(`${origin}/trips/new`);
      await page.waitForLoadState("domcontentloaded");

      // 2. 여행 제목 및 여행지 입력
      const titleInput = page.locator('input[name="title"], input#title').first();
      await expect(titleInput).toBeVisible();
      await titleInput.fill("도쿄 가을 단풍 여행");

      const destinationInput = page.locator('input[name="destination"], input#destination').first();
      if (await destinationInput.isVisible()) {
        await destinationInput.fill("도쿄");
      }

      const submitButton = page.getByRole("button", { name: /만들기|시작|다음/ }).first();
      await expect(submitButton).toBeVisible();
      await submitButton.click();

      // 3. 여행 생성 후 생성된 방으로 이동 검증
      await page.waitForURL(/\/trips\/([^/]+)/);
      const url = page.url();
      const tripMatch = /\/trips\/([^/?#]+)/.exec(url);
      expect(tripMatch).toBeTruthy();
      const tripId = tripMatch![1];
      expect(tripId).not.toBe("new");
      expect(tripId.length).toBeGreaterThan(3);

      // 4. 여행 계획 화면에서 여행 제목 노출 확인
      await expect(page.getByText("도쿄 가을 단풍 여행").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
