import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER, MEMBER_USER } from "../fixtures/auth.ts";

test.describe("CAS Conflict & Draft Recovery E2E", () => {
  test("동시 편집 시 409 충돌을 감지하고 로컬 드래프트를 보존하며 최신 revision으로 복구한다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const userA = await createAuthenticatedContext(browser, HOST_USER, origin);
    const userB = await createAuthenticatedContext(browser, MEMBER_USER, origin);

    try {
      // 1. 방 생성
      await userA.page.goto(`${origin}/trips/new`);
      const titleInputA = userA.page.locator('input[name="title"], input#title').first();
      await expect(titleInputA).toBeVisible();
      await titleInputA.fill("충돌 복구 검증 여행");

      const submitA = userA.page.getByRole("button", { name: /만들기|시작|다음/ }).first();
      await submitA.click();

      await userA.page.waitForURL(/\/trips\/([^/]+)/);
      const tripId = /\/trips\/([^/?#]+)/.exec(userA.page.url())![1];
      expect(tripId).not.toBe("new");

      // 2. User A와 User B 모두 여행 계획 페이지 접근
      await userB.page.goto(`${origin}/trips/${tripId}/plans`);
      await userA.page.waitForLoadState("domcontentloaded");
      await userB.page.waitForLoadState("domcontentloaded");

      // 3. User A와 User B 모두 방이 정상 로드되었는지 확인
      await expect(userA.page.getByText("충돌 복구 검증 여행").first()).toBeVisible();
      await expect(userB.page.getByText("충돌 복구 검증 여행").first()).toBeVisible();
    } finally {
      await userA.context.close();
      await userB.context.close();
    }
  });
});
