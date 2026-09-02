import { expect, test } from "@playwright/test";
import {
  createAuthenticatedContext,
  HOST_USER,
  MEMBER_USER,
} from "../fixtures/auth.ts";
import {
  confirmPlanViaApi,
  createPlanViaApi,
  issueInviteViaApi,
  joinInviteViaUi,
} from "../fixtures/collaboration.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";
import { createTrip } from "../fixtures/trip.ts";

test.describe("Direct Navigation and Refresh Web E2E", () => {
  test("Host와 Member가 Trip Room route를 직접 열고 새로고침한다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(
      browser,
      HOST_USER,
      origin,
    );
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);
    const tripTitle = uniqueTestTitle("직접 진입 여행", testInfo);
    const planTitle = uniqueTestTitle("직접 진입 여행안", testInfo);

    try {
      const tripId = await createTrip(host.page, origin, tripTitle);
      const inviteToken = await issueInviteViaApi(
        host.context,
        origin,
        tripId,
      );
      await joinInviteViaUi(member.page, origin, inviteToken, "Member Joined");
      const plan = await createPlanViaApi(host.context, origin, tripId, planTitle);
      await confirmPlanViaApi(host.context, origin, tripId, plan.id);

      await host.page.goto(`${origin}/trips/${tripId}`);
      await host.page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/itinerary`,
      );
      await expect(host.page.getByText(planTitle, { exact: true })).toBeVisible();

      const hostRoutes = [
        { path: `/trips/${tripId}/plans`, text: planTitle },
        { path: `/trips/${tripId}/itinerary`, text: planTitle },
        { path: `/trips/${tripId}/plans/${plan.id}`, text: planTitle },
        { path: `/trips/${tripId}/itinerary/edit`, text: "확정 일정 수정" },
      ];
      for (const route of hostRoutes) {
        await host.page.goto(`${origin}${route.path}`);
        await expect(host.page.getByText(route.text, { exact: true })).toBeVisible();
        await expect(
          host.page.getByRole("navigation", { name: "주요 화면" }),
        ).toHaveCount(0);
        await host.page.reload();
        await expect(host.page.getByText(route.text, { exact: true })).toBeVisible();
      }

      await host.page.goto(`${origin}/trips/${tripId}/plans/${plan.id}/edit`);
      await expect(
        host.page.getByRole("heading", {
          name: "확정된 여행에서는 여행안을 수정할 수 없습니다",
        }),
      ).toBeVisible();

      const memberRoutes = [
        { path: `/trips/${tripId}`, text: planTitle },
        { path: `/trips/${tripId}/plans`, text: planTitle },
        { path: `/trips/${tripId}/itinerary`, text: planTitle },
        { path: `/trips/${tripId}/plans/${plan.id}`, text: planTitle },
      ];
      for (const route of memberRoutes) {
        await member.page.goto(`${origin}${route.path}`);
        if (route.path === `/trips/${tripId}`) {
          await member.page.waitForURL(
            (url) => url.pathname === `/trips/${tripId}/itinerary`,
          );
        }
        await expect(member.page.getByText(route.text, { exact: true })).toBeVisible();
        await expect(
          member.page.getByRole("navigation", { name: "주요 화면" }),
        ).toHaveCount(0);
        await member.page.reload();
        await expect(member.page.getByText(planTitle, { exact: true })).toBeVisible();
      }

      await member.page.goto(`${origin}/trips/${tripId}/itinerary/edit`);
      await expect(
        member.page.getByRole("heading", { name: "수정 권한이 없습니다" }),
      ).toBeVisible();

      const coldContext = await browser.newContext();
      try {
        const coldPage = await coldContext.newPage();
        await coldPage.goto(`${origin}/invites/${inviteToken}`);
        await expect(
          coldPage.getByLabel("어떤 이름으로 참여할까요?"),
        ).toBeVisible();
      } finally {
        await coldContext.close();
      }
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
