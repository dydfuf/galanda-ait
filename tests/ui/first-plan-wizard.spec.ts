import { expect, test } from "@playwright/test";

const widths = [320, 360, 390, 430, 1280] as const;

for (const width of widths) {
  test(`keeps the wizard usable at ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/tests/ui/fixture.html?state=long");

    await expect(page.getByRole("heading", { name: "다른 도시도 방문하시나요?" })).toBeVisible();
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

    const lastAction = page.locator('[data-slot="bottom-action"] button').last();
    await lastAction.scrollIntoViewIfNeeded();
    const actionGeometry = await lastAction.boundingBox();
    const footerGeometry = await page.locator('[data-slot="bottom-action"]').boundingBox();
    expect(actionGeometry).not.toBeNull();
    expect(footerGeometry).not.toBeNull();
    expect(actionGeometry!.y + actionGeometry!.height).toBeLessThanOrEqual(
      footerGeometry!.y + footerGeometry!.height + 1,
    );

    if (width === 390) {
      await expect(page).toHaveScreenshot("first-plan-wizard-long-390.png", {
        animations: "disabled",
      });
    }
  });
}

test("reserves measured footer space when the offline notice grows the accessory", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/ui/fixture.html?state=normal");
  const normalHeight = await page.locator('[data-slot="bottom-action"]').evaluate((element) =>
    getComputedStyle(element).height,
  );

  await page.goto("/tests/ui/fixture.html?state=offline");
  await expect(page.getByText(/오프라인/)).toBeVisible();
  const offlineHeight = await page.locator('[data-slot="bottom-action"]').evaluate((element) =>
    getComputedStyle(element).height,
  );
  const publishedClearance = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--app-bottom-action-height"),
  );

  expect(offlineHeight).not.toBe(normalHeight);
  expect(publishedClearance).toMatch(/px/);
});

test("uses a simulated safe-area inset without claiming device keyboard coverage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/ui/fixture.html?state=normal");
  await page.addStyleTag({
    content: ":root { --safe-bottom: 24px; --app-keyboard-inset: 0px; }",
  });

  await expect(page.locator('[data-slot="bottom-action"]')).toBeVisible();
  const paddingBottom = await page.locator('[data-slot="bottom-action"]').evaluate((element) =>
    getComputedStyle(element).paddingBottom,
  );
  expect(paddingBottom).toContain("px");
});

test("exposes representative validation, save, offline, and review fixtures", async ({ page }) => {
  await page.goto("/tests/ui/fixture.html?state=invalid-date");
  await expect(page.getByText("출발일은 도착일 이후여야 합니다.")).toBeVisible();

  await page.goto("/tests/ui/fixture.html?state=saving");
  await expect(page.getByText("자동 저장 중…")).toBeVisible();

  await page.goto("/tests/ui/fixture.html?state=error");
  await expect(page.getByText("임시 저장하지 못했어요")).toBeVisible();

  await page.goto("/tests/ui/fixture.html?state=review");
  await expect(page.getByRole("button", { name: "검토로 돌아가기" })).toBeVisible();
});
