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
import { createTrip } from "../fixtures/trip.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";

test.describe("Itinerary Review and Acknowledgement Web E2E", () => {
  test("일정 수정이 변경 전후 리뷰로 보이고 Member의 명시적 확인 후 사라진다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(browser, HOST_USER, origin);
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);
    const tripTitle = uniqueTestTitle("일정 리뷰 검증 여행", testInfo);
    const planTitle = uniqueTestTitle("확정 여행안", testInfo);
    const revisedMemo = uniqueTestTitle("호스트가 변경한 일정 메모", testInfo);

    try {
      const tripId = await createTrip(host.page, origin, tripTitle);
      const inviteToken = await issueInviteViaApi(host.context, origin, tripId);
      await joinInviteViaUi(member.page, origin, inviteToken, "Member Joined");
      const plan = await createPlanViaApi(
        host.context,
        origin,
        tripId,
        planTitle,
      );
      await confirmPlanViaApi(host.context, origin, tripId, plan.id);

      await host.page.goto(`${origin}/trips/${tripId}/itinerary`);
      await expect(host.page.getByRole("heading", { name: planTitle })).toBeVisible();
      await host.page.getByRole("button", { name: "일정 수정" }).click();
      await host.page.getByLabel("메모").first().fill(revisedMemo);

      const reviseResponse = host.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PATCH" &&
          new URL(request.url()).pathname === `/api/trips/${tripId}/itinerary`
        );
      });
      await host.page.getByRole("button", { name: "변경 저장" }).click();
      expect((await reviseResponse).status()).toBe(200);
      await host.page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/itinerary`,
      );

      await member.page.goto(`${origin}/trips/${tripId}/itinerary`);
      await expect(
        member.page.getByText(/일정이 v2로 변경됐어요/, { exact: true }),
      ).toBeVisible();
      await expect(
        member.page.getByText("아직 확인하지 않은 참여자 2명", { exact: true }),
      ).toBeVisible();

      const activityButton = member.page.getByRole("button", {
        name: /활동 알림/,
      });
      await activityButton.click();
      const activityDrawer = member.page.getByRole("dialog", {
        name: "활동 알림",
      });
      await expect(activityDrawer).toBeVisible();
      const markRead = activityDrawer.getByRole("button", {
        name: "현재까지 모두 확인",
      });
      await markRead.click();
      await member.page.keyboard.press("Escape");
      await expect(
        member.page.getByRole("button", { name: "변경 내용 확인" }),
      ).toBeVisible();

      await member.page.getByRole("button", { name: "변경 내용 확인" }).click();
      const reviewDrawer = member.page.getByRole("dialog", {
        name: "변경된 일정 확인",
      });
      await expect(reviewDrawer).toContainText(revisedMemo);
      const acknowledgementResponse = member.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "POST" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/itinerary/acknowledgements`
        );
      });
      await reviewDrawer.getByRole("button", { name: "확인했어요" }).click();
      expect((await acknowledgementResponse).status()).toBe(200);
      await expect(
        member.page.getByRole("button", { name: "변경 내용 확인" }),
      ).not.toBeVisible();

      await member.page.reload();
      await expect(
        member.page.getByRole("button", { name: "변경 내용 확인" }),
      ).not.toBeVisible();
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
