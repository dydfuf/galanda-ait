import { type Browser, type BrowserContext, type Page } from "@playwright/test";

export interface TestSessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export const HOST_USER: TestSessionUser = {
  id: "part-qa-host-01",
  name: "Host Alice",
  email: "qa-host@galanda.internal",
};

export const MEMBER_USER: TestSessionUser = {
  id: "part-qa-member-02",
  name: "Member Bob",
  email: "qa-member@galanda.internal",
};

export async function createAuthenticatedContext(
  browser: Browser,
  user: TestSessionUser,
  baseURL: string = "http://localhost:5173"
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();

  // Set mock session cookies / local storage if needed for local test server
  await context.addCookies([
    {
      name: "galanda_test_user",
      value: JSON.stringify(user),
      domain: new URL(baseURL).hostname,
      path: "/",
    },
  ]);

  const page = await context.newPage();
  return { context, page };
}
