// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { issueTripInvite } from "../../app/api-client.ts";
import type { PlatformAdapter } from "../../platform/types.ts";
import type { copyToClipboard } from "../../platform/web/adapter.ts";
import { InviteTokenSchema } from "../../core/domain/ids.ts";
const fixtureToken = InviteTokenSchema.make("00000000-0000-4000-8000-000000000001");
const mocks = vi.hoisted(() => ({ issue: vi.fn<typeof issueTripInvite>(), share: vi.fn<PlatformAdapter["share"]>(), copy: vi.fn<typeof copyToClipboard>(), session: { participantId: "host", accountType: "REGISTERED", isAuthenticated: true } as { participantId: string; accountType: string; isAuthenticated: boolean } | null }));
vi.mock("../../hooks/useSession.ts", () => ({ useSessionQuery: () => ({ data: mocks.session }) }));
vi.mock("../../app/api-client.ts", () => ({ issueTripInvite: mocks.issue }));
vi.mock("../../platform/index.ts", () => ({ platform: { share: mocks.share } }));
vi.mock("../../platform/web/adapter.ts", () => ({ copyToClipboard: mocks.copy }));
import { InviteShareFallback } from "./InviteShareFallback.tsx";
import { shareTripInvite } from "./share-trip-invite.ts";
import { getInviteShareFallback, setInviteShareFallback } from "./invite-share-fallback.ts";
function Fixture() {
  const navigate = useNavigate();
  return <><InviteShareFallback /><button onClick={() => navigate("/trips")}>이동</button></>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { participantId: "host", accountType: "REGISTERED", isAuthenticated: true };
  setInviteShareFallback(undefined);
  mocks.issue.mockResolvedValue({ token: fixtureToken, expiresAt: "2099-01-01T00:00:00Z" });
  mocks.share.mockResolvedValue("unsupported");
  mocks.copy.mockResolvedValue("unsupported");
});

it.each(["issue", "share"] as const)("discards pending %s after navigation, logout, or account change", async (phase) => {
  for (const transition of ["navigate", "logout", "account"] as const) {
    mocks.session = { participantId: "host", accountType: "REGISTERED", isAuthenticated: true };
    let finish!: () => void;
    if (phase === "issue") mocks.issue.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ token: fixtureToken, expiresAt: "2099-01-01T00:00:00Z" }); }));
    else mocks.share.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve("unsupported"); }));
    const view = render(<MemoryRouter><Fixture /></MemoryRouter>);
    let pending!: ReturnType<typeof shareTripInvite>;
    await act(async () => { pending = shareTripInvite("trip-1"); });
    const shareCount = mocks.share.mock.calls.length;
    if (transition === "navigate") fireEvent.click(screen.getByRole("button", { name: "이동" }));
    else {
      mocks.session = transition === "logout" ? null : { participantId: "other", accountType: "REGISTERED", isAuthenticated: true };
      view.rerender(<MemoryRouter><Fixture /></MemoryRouter>);
    }
    await act(async () => { finish(); expect(await pending).toBe("cancelled"); });
    expect(getInviteShareFallback()).toBeUndefined();
    expect(screen.queryByLabelText("초대 링크")).not.toBeInTheDocument();
    if (phase === "issue") expect(mocks.share).toHaveBeenCalledTimes(shareCount);
    view.unmount();
  }
});
it("keeps the issued link selectable and retries copying without issuing another invite", async () => {
  render(<MemoryRouter><Fixture /></MemoryRouter>);
  await act(async () => { await shareTripInvite("trip-1"); });
  const input = screen.getByLabelText("초대 링크") as HTMLInputElement;
  expect(input.readOnly).toBe(true);
  expect(input.value.endsWith(`/invites/${fixtureToken}`)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("직접 복사"));
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  mocks.copy.mockResolvedValue("copied");
  fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("복사했어요"));
  expect(mocks.issue).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(getInviteShareFallback()).toBeUndefined();
});
it("clears the capability when navigating away", async () => {
  render(<MemoryRouter><Fixture /></MemoryRouter>);
  await act(async () => { await shareTripInvite("trip-1"); });
  fireEvent.click(screen.getByRole("button", { name: "이동", hidden: true }));
  expect(getInviteShareFallback()).toBeUndefined();
});
it("recovers a thrown platform error with the issued link but does not override cancellation", async () => {
  mocks.share.mockRejectedValueOnce(new Error("share unavailable"));
  expect(await shareTripInvite("trip-1")).toBe("unsupported");
  expect(getInviteShareFallback()).toBeDefined();
  setInviteShareFallback(undefined);
  mocks.share.mockResolvedValue("cancelled");
  expect(await shareTripInvite("trip-1")).toBe("cancelled");
  expect(getInviteShareFallback()).toBeUndefined();
});
it("does not show a link when issuance fails", async () => {
  mocks.issue.mockRejectedValue(new Error("not authorized"));
  expect(await shareTripInvite("trip-1")).toBe("failed");
  expect(getInviteShareFallback()).toBeUndefined();
  expect(mocks.share).not.toHaveBeenCalled();
});

it("does not restore copy status after the drawer closes during a pending copy", async () => {
  let finishCopy!: (outcome: "copied") => void;
  mocks.copy.mockImplementationOnce(() => new Promise((resolve) => { finishCopy = resolve; }));
  render(<MemoryRouter><Fixture /></MemoryRouter>);
  await act(async () => { await shareTripInvite("trip-1"); });
  fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  await act(async () => { finishCopy("copied"); });
  await act(async () => { await shareTripInvite("trip-1"); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("clears completed copy status when closing and reopening the same link", async () => {
  mocks.copy.mockResolvedValue("copied");
  render(<MemoryRouter><Fixture /></MemoryRouter>);
  await act(async () => { await shareTripInvite("trip-1"); });
  fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("복사했어요"));
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  await act(async () => { await shareTripInvite("trip-1"); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
