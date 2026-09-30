// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionKeys } from "@/hooks/useSession.ts";
import { SignOutButton } from "./SignOutButton.tsx";

function setup() {
  const client = new QueryClient();
  client.setQueryData(["private-trip"], { name: "Private trip" });
  client.setQueryData(sessionKeys.current(), { participantId: "host" });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/me"]}>
    <Routes>
      <Route path="/me" element={<SignOutButton />} />
      <Route path="/login" element={<h1>로그인 화면</h1>} />
    </Routes>
  </MemoryRouter></QueryClientProvider>);
  return client;
}

afterEach(() => vi.unstubAllGlobals());

describe("SignOutButton", () => {
  it("waits for the server, blocks duplicate submission, then clears private queries and opens login", async () => {
    let complete!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const client = setup();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByRole("button", { name: "로그아웃 중…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃 중…" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["private-trip"])).toBeDefined();
    complete(new Response('{}', { status: 200 }));
    await screen.findByRole("heading", { name: "로그인 화면" });
    expect(client.getQueryData(["private-trip"])).toBeUndefined();
    expect(client.getQueryData(sessionKeys.current())).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-out", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
  });

  it.each(["server", "network"])("preserves session and supports retry after %s failure", async (failure) => {
    const fetchMock = vi.fn();
    if (failure === "server") fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    else fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = setup();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("alert");
    expect(client.getQueryData(["private-trip"])).toBeDefined();
    expect(client.getQueryData(sessionKeys.current())).toEqual({ participantId: "host" });
    await waitFor(() => expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인 화면" });
  });
});
