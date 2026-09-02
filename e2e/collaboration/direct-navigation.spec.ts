import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER } from "../fixtures/auth.ts";
import { createPlanViaApi } from "../fixtures/collaboration.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";
import { createTrip } from "../fixtures/trip.ts";

test.describe("Direct Navigation and Refresh Web E2E", () => {
  test("Trip Room 하위 URL을 직접 열고 새로고침한 뒤 뒤로 이동한다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(
      browser,
      HOST_USER,
      origin,
    );
    const tripTitle = uniqueTestTitle("직접 진입 여행", testInfo);
    const planTitle = uniqueTestTitle("직접 진입 여행안", testInfo);

    try {
      const tripId = await createTrip(page, origin, tripTitle);
      const plan = await createPlanViaApi(
        context,
        origin,
        tripId,
        planTitle,
      );

      await page.goto(`${origin}/trips/${tripId}`);
      await page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/plans`,
      );
      await expect(page.getByText(tripTitle, { exact: true })).toBeVisible();

      await page.goto(`${origin}/trips/${tripId}/plans/${plan.id}`);
      await expect(page.getByRole("heading", { name: planTitle })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "주요 화면" }),
      ).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("heading", { name: planTitle })).toBeVisible();

      await page.getByRole("button", { name: "뒤로 가기" }).click();
      await page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/plans`,
      );
      await expect(page.getByText(planTitle, { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
