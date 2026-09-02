import { expect, type BrowserContext, type Page } from "@playwright/test";
import { publishablePlan } from "./trip.ts";

interface RoomSnapshot {
  readonly revision: number;
  readonly plans: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

export async function createPlanViaApi(
  context: BrowserContext,
  origin: string,
  tripId: string,
  title: string,
): Promise<{ readonly id: string; readonly title: string }> {
  const roomResponse = await context.request.get(`${origin}/api/trips/${tripId}`);
  expect(roomResponse.status()).toBe(200);
  const room = (await roomResponse.json()) as RoomSnapshot;
  const response = await context.request.post(
    `${origin}/api/trips/${tripId}/plans`,
    {
      data: {
        ...publishablePlan,
        title,
        proposalReason: "Web 협업 E2E 검증",
        expectedRevision: room.revision,
      },
    },
  );
  expect(response.status()).toBe(201);
  const createdRoom = (await response.json()) as RoomSnapshot;
  const plan = createdRoom.plans.find((candidate) => candidate.title === title);
  expect(plan).toBeDefined();
  return plan!;
}

export async function issueInviteViaApi(
  context: BrowserContext,
  origin: string,
  tripId: string,
): Promise<string> {
  const response = await context.request.post(
    `${origin}/api/trips/${tripId}/invites`,
  );
  expect(response.status()).toBe(201);
  const invite = (await response.json()) as { readonly token: string };
  expect(invite.token).toBeTruthy();
  return invite.token;
}

export async function joinInviteViaUi(
  page: Page,
  origin: string,
  inviteToken: string,
  nickname: string,
): Promise<void> {
  await page.goto(`${origin}/invites/${inviteToken}`);
  await expect(
    page.getByLabel("어떤 이름으로 참여할까요?"),
  ).toBeVisible();
  await page.getByLabel("어떤 이름으로 참여할까요?").fill(nickname);
  const joinResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      new URL(request.url()).pathname ===
        `/api/invites/${inviteToken}/join`
    );
  });
  await page.getByRole("button", { name: "이 이름으로 참여하기" }).click();
  expect((await joinResponse).status()).toBe(200);
}

export async function submitOpinionViaUi(
  page: Page,
  origin: string,
  tripId: string,
  planId: string,
  reactionLabel = "좋아요",
): Promise<void> {
  await page.goto(`${origin}/trips/${tripId}/plans/${planId}`);
  await page.getByRole("button", { name: /내 의견 (남기기|수정하기)/ }).click();
  const sheet = page.getByRole("dialog", { name: "이 여행안은 어때요?" });
  await expect(sheet).toBeVisible();
  await sheet.getByText(reactionLabel, { exact: true }).click();
  const opinionResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PUT" &&
      new URL(request.url()).pathname ===
        `/api/trips/${tripId}/plans/${planId}/opinion`
    );
  });
  await sheet.getByRole("button", { name: "의견 저장하기" }).click();
  expect((await opinionResponse).status()).toBe(200);
}

export async function confirmPlanViaApi(
  context: BrowserContext,
  origin: string,
  tripId: string,
  planId: string,
): Promise<void> {
  const roomResponse = await context.request.get(`${origin}/api/trips/${tripId}`);
  expect(roomResponse.status()).toBe(200);
  const room = (await roomResponse.json()) as RoomSnapshot;
  const response = await context.request.post(
    `${origin}/api/trips/${tripId}/plans/${planId}/confirm`,
    { data: { expectedRevision: room.revision } },
  );
  expect(response.status()).toBe(200);
}
