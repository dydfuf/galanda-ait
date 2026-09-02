import { test, expect } from "@playwright/test";
import { getStayNightCount } from "../../src/core/domain/room.ts";
import { createAuthenticatedContext, HOST_USER } from "../fixtures/auth.ts";
import { createTrip, publishablePlan } from "../fixtures/trip.ts";
import { futureTravelPeriod, uniqueTestTitle } from "../fixtures/dates.ts";

test.describe("Trip Creation and Plan Publication E2E", () => {
  test("publishablePlan의 숙박 일수가 여행 기간과 일치한다", () => {
    const route = publishablePlan.routes[0];
    const stay = publishablePlan.accommodations[0];

    expect(route).toBeDefined();
    expect(stay).toBeDefined();
    expect(stay.nights).toBe(getStayNightCount(route));
  });

  test("Host가 새 여행을 생성하고 첫 여행안을 작성하여 공개한다", async ({ browser, baseURL }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const title = uniqueTestTitle("도쿄 가을 단풍 여행", testInfo);
    const planTitle = `${title} 여행안`;
    const dates = futureTravelPeriod();
    const { context, page } = await createAuthenticatedContext(browser, HOST_USER, origin);

    try {
      const tripId = await createTrip(page, origin, title);
      await page.getByRole("button", { name: "미정으로 두고 다음" }).click();
      await page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/plans/new/basic`,
      );

      await page.getByLabel("여행안 제목 *").fill(planTitle);
      await page.getByRole("button", { name: "다음: 여행 경로" }).click();
      await page.getByRole("button", { name: "+ 방문 도시 추가" }).click();
      await page.locator("#route-0-city").fill("도쿄");
      await page.locator("#route-0-arrival").fill(dates.startDate);
      await page.locator("#route-0-departure").fill(dates.endDate);
      await page.getByRole("button", { name: "다음: 숙소" }).click();
      await page.getByRole("button", { name: "+ 숙소 구간 추가" }).click();
      await page.getByRole("button", { name: "다음: 교통" }).click();

      const addTransport = page.getByRole("button", {
        name: "+ 교통 이동 구간 추가",
      });
      await addTransport.click();
      await expect(page.getByLabel("출발지")).toHaveCount(1);
      await addTransport.click();
      await expect(page.getByLabel("출발지")).toHaveCount(2);
      await page.getByLabel("출발지").nth(0).fill("인천");
      await page.getByLabel("도착지").nth(0).fill("도쿄");
      await page.getByLabel("출발지").nth(1).fill("도쿄");
      await page.getByLabel("도착지").nth(1).fill("인천");
      await page.getByRole("button", { name: "입력 내용 검토하기" }).click();

      const createPlanResponse = page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "POST" &&
          new URL(request.url()).pathname === `/api/trips/${tripId}/plans`
        );
      });
      await page.getByRole("button", { name: "첫 여행안 등록하기" }).click();
      const response = await createPlanResponse;
      expect(response.status()).toBe(201);
      const updatedRoom = (await response.json()) as {
        plans: ReadonlyArray<{ id: string; title: string; status: string }>;
      };
      const createdPlan = updatedRoom.plans.at(-1);
      expect(createdPlan).toBeDefined();
      expect(createdPlan).toMatchObject({
        title: planTitle,
        status: "VOTING",
      });

      await page.waitForURL((url) => url.pathname === `/trips/${tripId}/plans`);
      const planLink = page.getByRole("link", {
        name: new RegExp(`기본안 ${planTitle}`),
      });
      await expect(planLink).toBeVisible();
      await planLink.click();
      await page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/plans/${createdPlan!.id}`,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: planTitle }),
      ).toBeVisible();
      await expect(page.getByText("기본안")).toBeVisible();
      await page.getByRole("button", { name: "뒤로 가기" }).click();
      await page.waitForURL((url) => url.pathname === `/trips/${tripId}/plans`);
      await expect(page.getByText(planTitle)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
