import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER, MEMBER_USER } from "../fixtures/auth.ts";
import { createTrip } from "../fixtures/trip.ts";

test.describe("Invite & Join Collaboration Journey E2E", () => {
  test("Host가 발급한 초대 링크를 통해 Member가 독립 세션에서 방에 참여한다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const host = await createAuthenticatedContext(browser, HOST_USER, origin);
    const member = await createAuthenticatedContext(browser, MEMBER_USER, origin);

    try {
      const tripId = await createTrip(host.page, origin, "오사카 우정 여행");

      const issueResponse = await host.context.request.post(
        `${origin}/api/trips/${tripId}/invites`,
      );
      expect(issueResponse.status()).toBe(201);
      const invite = (await issueResponse.json()) as {
        token: string;
        expiresAt: string;
      };
      expect(invite.token.length).toBeGreaterThan(10);
      expect(invite.expiresAt).toBeTruthy();

      await member.page.goto(`${origin}/invites/${invite.token}`);
      await member.page.waitForURL(
        (url) => url.pathname === `/invites/${invite.token}`,
      );
      await expect(
        member.page.getByRole("heading", {
          name: "오사카 우정 여행에 초대받았어요",
        }),
      ).toBeVisible();
      await member.page.getByLabel("어떤 이름으로 참여할까요?").fill("Member Joined");

      const joinResponse = member.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "POST" &&
          new URL(request.url()).pathname === `/api/invites/${invite.token}/join`
        );
      });
      await member.page.getByRole("button", { name: "이 이름으로 참여하기" }).click();
      const response = await joinResponse;
      expect(response.status()).toBe(200);
      await member.page.waitForURL(
        (url) => url.pathname === `/trips/${tripId}/plans`,
      );

      const joinedRoomResponse = await member.context.request.get(
        `${origin}/api/trips/${tripId}`,
      );
      expect(joinedRoomResponse.status()).toBe(200);
      const joinedRoom = (await joinedRoomResponse.json()) as {
        members: ReadonlyArray<{ id: string; name: string; role: string }>;
      };
      expect(joinedRoom.members).toEqual(
        expect.arrayContaining([
          {
            id: member.session.participantId,
            name: "Member Joined",
            role: "MEMBER",
          },
        ]),
      );
      expect(joinedRoom.members.map(({ id }) => id)).toContain(host.session.participantId);
      expect(member.session.participantId).not.toBe(host.session.participantId);
      await expect(member.page.getByText("오사카 우정 여행")).toBeVisible();
    } finally {
      await host.context.close();
      await member.context.close();
    }
  });
});
