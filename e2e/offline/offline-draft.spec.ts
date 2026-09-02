import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER } from "../fixtures/auth.ts";
import {
  confirmPlanViaApi,
  createPlanViaApi,
} from "../fixtures/collaboration.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";
import { createTrip } from "../fixtures/trip.ts";

test.describe("Offline Detection and Draft Preservation E2E", () => {
  test("실제 여행안 편집 초안은 오프라인에서도 유지되고 복귀 후 저장된다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(
      browser,
      HOST_USER,
      origin,
    );
    const tripTitle = uniqueTestTitle("오프라인 초안 여행", testInfo);
    const planTitle = uniqueTestTitle("오프라인 초안 기준안", testInfo);
    const draftTitle = uniqueTestTitle("오프라인에서 작성한 제목", testInfo);

    try {
      const tripId = await createTrip(page, origin, tripTitle);
      const plan = await createPlanViaApi(
        context,
        origin,
        tripId,
        planTitle,
      );
      await page.goto(`${origin}/trips/${tripId}/plans/${plan.id}/edit`);
      await page.getByRole("button", { name: /기본 정보/ }).click();
      const titleInput = page.getByLabel("여행안 제목 *");
      await expect(titleInput).toBeEditable();
      await titleInput.fill(draftTitle);
      await page.getByRole("button", { name: "편집 완료" }).click();

      const writes: string[] = [];
      page.on("request", (request) => {
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
          writes.push(request.url());
        }
      });
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));

      await expect(
        page.locator('[role="status"]').filter({
          hasText: "오프라인 상태입니다.",
        }),
      ).toBeVisible();
      await page.getByRole("button", { name: /기본 정보/ }).click();
      const offlineTitleInput = page.getByLabel("여행안 제목 *");
      await expect(offlineTitleInput).toBeEditable();
      await offlineTitleInput.fill(`${draftTitle} 계속 입력`);
      await page.getByRole("button", { name: "편집 완료" }).click();
      const saveButton = page.getByRole("button", { name: "수정안 반영하기" });
      await expect(saveButton).toBeDisabled();
      expect(writes).toHaveLength(0);

      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(saveButton).toBeEnabled();
      const saveResponse = page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PATCH" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/plans/${plan.id}`
        );
      });
      await saveButton.click();
      expect((await saveResponse).status()).toBe(200);
      await page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/plans/${plan.id}`,
      );
      await expect(page.getByRole("heading", { name: `${draftTitle} 계속 입력` })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("확정 일정 수정 초안은 오프라인에서 유지되고 자동 재전송되지 않는다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(
      browser,
      HOST_USER,
      origin,
    );
    const tripTitle = uniqueTestTitle("오프라인 일정 여행", testInfo);
    const planTitle = uniqueTestTitle("오프라인 일정 기준안", testInfo);
    const draftMemo = uniqueTestTitle("오프라인 일정 메모", testInfo);

    try {
      const tripId = await createTrip(page, origin, tripTitle);
      const plan = await createPlanViaApi(context, origin, tripId, planTitle);
      await confirmPlanViaApi(context, origin, tripId, plan.id);
      await page.goto(`${origin}/trips/${tripId}/itinerary/edit`);

      const memoInput = page.getByLabel("메모").first();
      await expect(memoInput).toBeEditable();
      const writes: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "PATCH") writes.push(request.url());
      });

      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await expect(
        page.locator('[role="status"]').filter({
          hasText: "오프라인 상태입니다.",
        }),
      ).toBeVisible();
      await memoInput.fill(draftMemo);
      const saveButton = page.getByRole("button", { name: "온라인 연결 후 저장" });
      await expect(saveButton).toBeDisabled();
      expect(writes).toHaveLength(0);

      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByRole("button", { name: "변경 저장" })).toBeEnabled();
      expect(writes).toHaveLength(0);

      const saveResponse = page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PATCH" &&
          new URL(request.url()).pathname === `/api/trips/${tripId}/itinerary`
        );
      });
      await page.getByRole("button", { name: "변경 저장" }).click();
      expect((await saveResponse).status()).toBe(200);
      await page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/itinerary`,
      );
      const itineraryResponse = await context.request.get(
        `${origin}/api/trips/${tripId}/itinerary`,
      );
      expect(itineraryResponse.status()).toBe(200);
      const itinerary = (await itineraryResponse.json()) as {
        readonly itinerary?: {
          readonly snapshot?: {
            readonly items?: ReadonlyArray<{ readonly memo?: string }>;
          };
        };
      };
      expect(
        itinerary.itinerary?.snapshot?.items?.some(
          (item) => item.memo === draftMemo,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
});
