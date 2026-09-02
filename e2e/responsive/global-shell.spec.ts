import { expect, test, type Page } from "@playwright/test";
import {
  createAuthenticatedContext,
  HOST_USER,
} from "../fixtures/auth.ts";
import {
  confirmPlanViaApi,
  createPlanViaApi,
} from "../fixtures/collaboration.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";
import { createTrip } from "../fixtures/trip.ts";

const assertNoHorizontalOverflow = async (page: Page) => {
  const offenders = await page.locator("body *").evaluateAll((elements) => {
    const viewportWidth = document.documentElement.clientWidth;

    return elements
      .filter((element) => {
        if (
          element.getAttribute("data-state") === "closed" ||
          element.getAttribute("aria-hidden") === "true"
        ) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < -0.5 || rect.right > viewportWidth + 0.5)
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: rect.left,
          right: rect.right,
        };
      });
  });
  expect(offenders).toEqual([]);
};

test.describe("Responsive Global Shell Web E2E", () => {
  test("Global 주요 화면과 focused 화면이 viewport를 넘기지 않는다", async ({
    browser,
    baseURL,
  }) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(
      browser,
      HOST_USER,
      origin,
    );

    try {
      for (const path of ["/home", "/explore", "/trips", "/me", "/me/saved"]) {
        await page.goto(`${origin}${path}`);
        const shell = page.locator('[data-slot="global-app-shell"]');
        await expect(shell).toBeVisible();
        const navigation = page.getByRole("navigation", { name: "주요 화면" });
        await expect(navigation).toBeVisible();
        await expect(navigation.getByRole("link")).toHaveCount(4);
        await assertNoHorizontalOverflow(page);
        const touchTargets = await navigation.getByRole("link").evaluateAll(
          (links) => links.map((link) => link.getBoundingClientRect().height),
        );
        expect(touchTargets.every((height) => height >= 44)).toBe(true);
      }

      await page.goto(`${origin}/trips/new`);
      await expect(page.locator('[data-slot="global-app-shell"]')).toHaveCount(0);
      await expect(
        page.getByRole("navigation", { name: "주요 화면" }),
      ).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test("미인증 사용자가 global route에 진입하면 로그인으로 이동한다", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL || "http://localhost:5173"}/home`);
    await expect(
      page,
    ).toHaveURL(/\/login\?.*returnTo=/);
  });

  test("Trip Room과 focused route도 viewport 밖으로 벗어나지 않는다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const { context, page } = await createAuthenticatedContext(
      browser,
      HOST_USER,
      origin,
    );
    const tripTitle = uniqueTestTitle("반응형 경로 검증 여행", testInfo);
    const planTitle = uniqueTestTitle("반응형 경로 검증안", testInfo);

    try {
      const tripId = await createTrip(page, origin, tripTitle);
      const plan = await createPlanViaApi(context, origin, tripId, planTitle);
      await confirmPlanViaApi(context, origin, tripId, plan.id);

      const routes = [
        { path: `/trips/${tripId}/plans`, text: planTitle },
        { path: `/trips/${tripId}/itinerary`, text: planTitle },
        { path: `/trips/${tripId}/plans/${plan.id}`, text: planTitle },
        { path: `/trips/${tripId}/itinerary/edit`, text: "확정 일정 수정" },
      ];
      for (const route of routes) {
        await page.goto(`${origin}${route.path}`);
        await expect(page.getByText(route.text, { exact: true })).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "주요 화면" }),
        ).toHaveCount(0);
        await assertNoHorizontalOverflow(page);
      }
    } finally {
      await context.close();
    }
  });
});
