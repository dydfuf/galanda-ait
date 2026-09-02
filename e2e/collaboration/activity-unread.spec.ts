import { expect, test, type Request } from "@playwright/test";
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
import { createTrip } from "../fixtures/trip.ts";
import { uniqueTestTitle } from "../fixtures/dates.ts";

test.describe("Activity Feed and Unread Mark-Read E2E", () => {
  test("실제 의견 활동만 unread로 보이고 Drawer 열기는 읽음 처리하지 않는다", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(browser, HOST_USER, origin);
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);
    const tripTitle = uniqueTestTitle("활동 알림 검증 여행", testInfo);
    const planTitle = uniqueTestTitle("활동 여행안", testInfo);

    try {
      const tripId = await createTrip(host.page, origin, tripTitle);
      const inviteToken = await issueInviteViaApi(host.context, origin, tripId);
      await joinInviteViaUi(
        member.page,
        origin,
        inviteToken,
        "Member Joined",
      );
      const plan = await createPlanViaApi(
        host.context,
        origin,
        tripId,
        planTitle,
      );

      await submitOpinionViaUi(member.page, origin, tripId, plan.id);
      await host.page.goto(`${origin}/trips/${tripId}/plans`);

      const bellButton = host.page.getByRole("button", { name: /활동 알림/ });
      await expect(bellButton).toHaveAccessibleName(/새 활동 \d+개/);

      const readRequests: string[] = [];
      const onRequest = (request: Request) => {
        if (
          request.method() === "PUT" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/activity/read`
        ) {
          readRequests.push(request.url());
        }
      };
      host.page.on("request", onRequest);
      await bellButton.click();
      const drawer = host.page.getByRole("dialog", { name: "활동 알림" });
      await expect(drawer).toBeVisible();
      await expect(
        drawer.getByText(/Member Joined님이 여행안 .*에 의견을 남겼어요/),
      ).toBeVisible();
      expect(readRequests).toHaveLength(0);

      const markReadResponse = host.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PUT" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/activity/read`
        );
      });
      await drawer.getByRole("button", { name: "현재까지 모두 확인" }).click();
      expect((await markReadResponse).status()).toBe(200);
      host.page.off("request", onRequest);
      await expect(bellButton).toHaveAccessibleName("활동 알림");

      await host.page.reload();
      await expect(
        host.page.getByRole("button", { name: "활동 알림" }),
      ).toBeVisible();

      const freshHost = await createAuthenticatedContext(browser, HOST_USER, origin);
      try {
        await freshHost.page.goto(`${origin}/trips/${tripId}/plans`);
        await expect(
          freshHost.page.getByRole("button", { name: "활동 알림" }),
        ).toBeVisible();
      } finally {
        await freshHost.context.close();
      }

      await submitOpinionViaUi(host.page, origin, tripId, plan.id);
      await host.page.goto(`${origin}/trips/${tripId}/plans`);
      await expect(
        host.page.getByRole("button", { name: "활동 알림" }),
      ).toBeVisible();

      await member.page.goto(`${origin}/trips/${tripId}/plans`);
      await expect(
        member.page.getByRole("button", { name: /새 활동 \d+개/ }),
      ).toBeVisible();
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
