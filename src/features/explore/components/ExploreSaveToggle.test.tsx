// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/api-client.ts", () => ({
  getExploreSaveState: vi.fn(),
  saveExploreListing: vi.fn(),
  unsaveExploreListing: vi.fn(),
  getSavedListings: vi.fn(),
}));
vi.mock("../../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import {
  getExploreSaveState,
  saveExploreListing,
  unsaveExploreListing,
} from "../../../app/api-client.ts";
import type { ExploreListingId } from "../../../core/domain/ids.ts";
import { useSessionQuery } from "../../../hooks/useSession.ts";
import { ExploreSaveToggle } from "./ExploreSaveToggle.tsx";

const mockState = vi.mocked(getExploreSaveState);
const mockSave = vi.mocked(saveExploreListing);
const mockUnsave = vi.mocked(unsaveExploreListing);
const mockUseSession = vi.mocked(useSessionQuery);

const listingId = "listing-1" as ExploreListingId;

const renderToggle = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ExploreSaveToggle listingId={listingId} />, { wrapper });
};

const readySession = () =>
  ({
    isSuccess: true,
    data: {
      participantId: "p-1",
      participantIds: ["p-1"],
      accountType: "REGISTERED",
      name: "u",
      isAuthenticated: true,
    },
  }) as unknown as ReturnType<typeof useSessionQuery>;

describe("ExploreSaveToggle (RAON-254 DISC-6)", () => {
  beforeEach(() => {
    mockState.mockReset();
    mockSave.mockReset();
    mockUnsave.mockReset();
    mockUseSession.mockReset();
  });

  it("세션 미준비/비로그인 시 toggle을 렌더하지 않는다", () => {
    mockUseSession.mockReturnValue({
      isSuccess: false,
      data: undefined,
    } as ReturnType<typeof useSessionQuery>);
    renderToggle();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("미저장 상태에서는 aria-pressed=false, 저장 label을 노출한다", async () => {
    mockUseSession.mockReturnValue(readySession());
    mockState.mockResolvedValue({ saved: false, saveCount: 0 });
    renderToggle();
    const button = await screen.findByRole("button", { name: "저장" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.querySelector('[data-slot="decision-icon"]')).toHaveAttribute("fill", "none");
  });

  it("저장 상태에서는 aria-pressed=true, 저장됨 label을 노출한다", async () => {
    mockUseSession.mockReturnValue(readySession());
    mockState.mockResolvedValue({ saved: true, saveCount: 0 });
    renderToggle();
    const button = await screen.findByRole("button", { name: "저장됨" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.querySelector('[data-slot="decision-icon"]')).toHaveAttribute("fill", "currentColor");
  });

  it("toggle 클릭 시 save를 호출하고 성공하면 저장됨으로 확정한다", async () => {
    mockUseSession.mockReturnValue(readySession());
    mockState.mockResolvedValue({ saved: false, saveCount: 0 });
    mockSave.mockImplementation(async () => {
      // 저장 성공 후 서버 진실도 saved=true로 바뀐다(invalidate 재조회 반영).
      mockState.mockResolvedValue({ saved: true, saveCount: 0 });
      return { saved: true, saveCount: 0 };
    });
    renderToggle();
    const button = await screen.findByRole("button", { name: "저장" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(listingId));
    await screen.findByRole("button", { name: "저장됨" });
    await waitFor(() => expect(button.querySelector('[data-slot="decision-icon"]')).toHaveAttribute("fill", "currentColor"));
  });

  it("save 실패 시 저장됨으로 표시하지 않고 rollback + 오류 안내한다", async () => {
    mockUseSession.mockReturnValue(readySession());
    mockState.mockResolvedValue({ saved: false, saveCount: 0 });
    mockSave.mockRejectedValue(new Error("boom"));
    renderToggle();
    const button = await screen.findByRole("button", { name: "저장" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    // 오류 alert가 뜨고, 상태는 다시 미저장(저장)으로 rollback된다.
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "저장" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(button.querySelector('[data-slot="decision-icon"]')).toHaveAttribute("fill", "none");
    // 실패를 "저장됨"으로 표시하지 않는다.
    expect(
      screen.queryByRole("button", { name: "저장됨" })
    ).not.toBeInTheDocument();
  });

  it("저장 상태에서 클릭하면 unsave를 호출한다", async () => {
    mockUseSession.mockReturnValue(readySession());
    mockState.mockResolvedValue({ saved: true, saveCount: 0 });
    mockUnsave.mockResolvedValue({ saved: false, saveCount: 0 });
    renderToggle();
    const button = await screen.findByRole("button", { name: "저장됨" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockUnsave).toHaveBeenCalledWith(listingId));
  });

  it("저장 해제 중에는 스피너를 표시하고 실패하면 채운 북마크로 복구한다", async () => {
    mockUseSession.mockReturnValue(readySession());
    mockState.mockResolvedValue({ saved: true, saveCount: 0 });
    let rejectUnsave!: (error: Error) => void;
    mockUnsave.mockImplementation(() => new Promise((_, reject) => {
      rejectUnsave = reject;
    }));
    renderToggle();
    const button = await screen.findByRole("button", { name: "저장됨" });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);
    await waitFor(() => {
      expect(mockUnsave).toHaveBeenCalledWith(listingId);
      expect(button).toBeDisabled();
      expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
      expect(button.querySelector('[data-slot="decision-icon"]')).toBeNull();
    });
    await act(async () => rejectUnsave(new Error("unsave failed")));

    await screen.findByRole("alert");
    await waitFor(() => {
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(button).toHaveAccessibleName("저장됨");
      expect(button.querySelector('[data-slot="decision-icon"]')).toHaveAttribute("fill", "currentColor");
      expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
    });
  });
});
