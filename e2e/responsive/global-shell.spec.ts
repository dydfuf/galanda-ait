import { expect, test, type Page } from "@playwright/test";

const assertNoHorizontalOverflow = async (page: Page) => {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
};

test.describe("Responsive Global Shell Web E2E", () => {
  test("Global 주요 화면과 focused 화면이 viewport를 넘기지 않는다", async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL || "http://localhost:5173";

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
  });
});
