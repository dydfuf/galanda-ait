import { readFileSync } from "node:fs";
import { type Browser, type BrowserContext, type Page } from "@playwright/test";

export interface TestSessionUser {
  readonly key: "host" | "member";
  readonly name: string;
  readonly email: string;
}

export const HOST_USER: TestSessionUser = {
  key: "host",
  name: "Host Alice",
  email: "qa-host@galanda.test",
};

export const MEMBER_USER: TestSessionUser = {
  key: "member",
  name: "Member Bob",
  email: "qa-member@galanda.test",
};

interface SeededSession {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly cookie: {
    readonly name: string;
    readonly value: string;
  };
}

interface SessionSeed {
  readonly host: SeededSession;
  readonly member: SeededSession;
}

interface UserSessionResponse {
  readonly participantId?: string;
  readonly participantIds?: ReadonlyArray<string>;
  readonly isAuthenticated?: boolean;
  readonly accountType?: string;
}

const loadSessionSeed = (): SessionSeed => {
  const seedPath = process.env.PLAYWRIGHT_AUTH_SEED_FILE;
  if (!seedPath) {
    throw new Error(
      "PLAYWRIGHT_AUTH_SEED_FILE is required; run scripts/seed-e2e-auth.ts first."
    );
  }

  return JSON.parse(readFileSync(seedPath, "utf8")) as SessionSeed;
};

export async function createAuthenticatedContext(
  browser: Browser,
  user: TestSessionUser,
  baseURL: string = "http://localhost:5173"
): Promise<{
  context: BrowserContext;
  page: Page;
  session: UserSessionResponse;
}> {
  const seeded = loadSessionSeed()[user.key];
  if (
    !seeded ||
    seeded.email !== user.email ||
    seeded.name !== user.name
  ) {
    throw new Error(`E2E auth seed does not contain ${user.key} (${user.email}).`);
  }

  const context = await browser.newContext();

  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: seeded.cookie.name,
      value: seeded.cookie.value,
      domain: url.hostname,
      path: "/",
      secure: url.protocol === "https:",
    },
  ]);

  const page = await context.newPage();
  const sessionResponse = await context.request.get(`${baseURL}/api/session`);
  if (!sessionResponse.ok()) {
    await context.close();
    throw new Error(
      `E2E auth session check failed with HTTP ${sessionResponse.status()}.`
    );
  }

  const session = (await sessionResponse.json()) as UserSessionResponse;
  if (
    session.isAuthenticated !== true ||
    session.accountType !== "REGISTERED" ||
    session.participantId !== seeded.id ||
    !session.participantIds?.includes(seeded.id)
  ) {
    await context.close();
    throw new Error(`E2E auth session is not registered for ${user.email}.`);
  }

  return { context, page, session };
}
