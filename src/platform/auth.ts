import type { UserSession } from "@/core/domain/room.ts";

export const safeReturnTo = (value: string | null): string =>
  value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/trips";

export const getLoginPath = (returnTo: string, upgrade = false): string => {
  const params = new URLSearchParams({ returnTo });
  if (upgrade) params.set("reason", "upgrade");
  return `/login?${params.toString()}`;
};

export const getSessionRedirect = (
  session: UserSession | null | undefined,
  returnTo: string,
  registered = false
): string | null => {
  if (!session?.isAuthenticated) return getLoginPath(returnTo);
  if (registered && session.accountType !== "REGISTERED") {
    return getLoginPath(returnTo, true);
  }
  return null;
};

export const postAuthJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error("로그인을 완료하지 못했습니다.");
  return payload as T;
};
