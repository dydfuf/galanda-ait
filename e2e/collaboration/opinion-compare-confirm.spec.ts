import { expect, test } from "@playwright/test";
import {
  createAuthenticatedContext,
  HOST_USER,
  MEMBER_USER,
} from "../fixtures/auth.ts";
import {
  createPlanViaApi,
  issueInviteViaApi,
  joinInviteViaUi,
  submitOpinionViaUi,
} from "../fixtures/collaboration.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";
import { createTrip } from "../fixtures/trip.ts";

test.describe("Opinion, Compare, Confirm Web E2E", () => {
  test("Member 의견이 비교 요약에 반영되고 Host가 비교 화면에서 확정한다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(browser, HOST_USER, origin);
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);
    const tripTitle = uniqueTestTitle("의견 비교 확정 여행", testInfo);
    const firstPlanTitle = uniqueTestTitle("기본 여행안", testInfo);
    const secondPlanTitle = uniqueTestTitle("대안 여행안", testInfo);

    try {
      const tripId = await createTrip(host.page, origin, tripTitle);
      const inviteToken = await issueInviteViaApi(host.context, origin, tripId);
      await joinInviteViaUi(member.page, origin, inviteToken, "Member Joined");
      const firstPlan = await createPlanViaApi(
        host.context,
        origin,
        tripId,
        firstPlanTitle,
      );
      const secondPlan = await createPlanViaApi(
        host.context,
        origin,
        tripId,
        secondPlanTitle,
      );

      await submitOpinionViaUi(
        member.page,
        origin,
        tripId,
        firstPlan.id,
        "좋아요",
      );
      await host.page.goto(
        `${origin}/trips/${tripId}/plans/compare?left=${firstPlan.id}&right=${secondPlan.id}`,
      );
      await expect(host.page.getByText(firstPlanTitle, { exact: true })).toBeVisible();
      await expect(host.page.getByText(secondPlanTitle, { exact: true })).toBeVisible();
      await expect(host.page.getByText("멤버 의견", { exact: true })).toBeVisible();

      const selectedPlanId = new URL(host.page.url()).searchParams.get("left");
      expect(selectedPlanId).toBe(firstPlan.id);
      await host.page
        .getByRole("button", { name: `선택한 '${firstPlanTitle}'으로 여행 확정하기` })
        .click();
      const confirmation = host.page.getByRole("dialog", {
        name: "이 여행안으로 확정할까요?",
      });
      await expect(confirmation).toBeVisible();

      const confirmResponse = host.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "POST" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/plans/${firstPlan.id}/confirm`
        );
      });
      await confirmation.getByRole("button", { name: "확정하기" }).click();
      expect((await confirmResponse).status()).toBe(200);
      await host.page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/itinerary`,
      );
      await expect(host.page.getByText("최종 확정", { exact: true })).toBeVisible();
      await expect(host.page.getByRole("heading", { name: firstPlanTitle })).toBeVisible();
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
