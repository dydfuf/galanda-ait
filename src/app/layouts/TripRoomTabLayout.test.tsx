// @vitest-environment jsdom
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformAdapter, PlatformNavigation } from "../../platform/types.ts";

type MutablePlatformAdapter = Omit<PlatformAdapter, "navigation"> & {
  navigation?: PlatformNavigation;
};

const mocks = vi.hoisted(() => ({
  platform: {
    name: "web",
    signIn: vi.fn<PlatformAdapter["signIn"]>().mockResolvedValue(undefined),
    share: vi.fn<PlatformAdapter["share"]>().mockResolvedValue("shared"),
    openExternalUrl: vi.fn<PlatformAdapter["openExternalUrl"]>().mockResolvedValue(undefined),
    requestClose: vi.fn<PlatformAdapter["requestClose"]>().mockResolvedValue(false),
    navigation: undefined,
  } as MutablePlatformAdapter,
}));

vi.mock("../../platform/index.ts", () => ({
  platform: mocks.platform,
}));

import { TripRoomTabLayout } from "./TripRoomTabLayout.tsx";

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={["/trips/trip-1/plans"]}>
      <Routes>
        <Route path="/trips/:tripId" element={<TripRoomTabLayout />}>
          <Route path="plans" element={<h1>계획 콘텐츠</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("TripRoomTabLayout shell ownership (RAON-229)", () => {
  beforeEach(() => {
    mocks.platform.navigation = undefined;
    vi.clearAllMocks();
  });

  it("Web/PWA는 safe-area header의 back/share와 mode switcher를 소유한다", () => {
    renderLayout();

    const header = screen.getByRole("banner");
    expect(header.className).toContain("pt-(--safe-top)");
    expect(screen.getByRole("button", { name: "뒤로 가기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여행 초대 링크 공유" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "여행방 화면" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "계획 콘텐츠" })).toBeInTheDocument();
  });

  it("AIT는 native inset/accessory를 사용하고 Web back/share를 중복 렌더하지 않는다", async () => {
    let onInsetChange: ((inset: number) => void) | undefined;
    const removeInsetListener = vi.fn<VoidFunction>();
    const navigation: PlatformNavigation = {
      contentTopInset: 54,
      subscribeContentTopInset: vi.fn<PlatformNavigation["subscribeContentTopInset"]>((onChange) => {
        onInsetChange = onChange;
        return removeInsetListener;
      }),
      addAccessoryButton: vi.fn<PlatformNavigation["addAccessoryButton"]>().mockResolvedValue(undefined),
      removeAccessoryButton: vi.fn<VoidFunction>(),
    };
    mocks.platform.navigation = navigation;

    const { unmount } = renderLayout();

    const header = screen.getByRole("banner");
    expect(header).toHaveStyle({ paddingTop: "54px" });
    expect(header.className).not.toContain("pt-(--safe-top)");
    expect(screen.queryByRole("button", { name: "뒤로 가기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "여행 초대 링크 공유" })).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "여행방 화면" })).toBeInTheDocument();
    await waitFor(() => expect(navigation.addAccessoryButton).toHaveBeenCalledTimes(1));

    act(() => onInsetChange?.(72));
    expect(header).toHaveStyle({ paddingTop: "72px" });

    unmount();
    expect(removeInsetListener).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(navigation.removeAccessoryButton).toHaveBeenCalledTimes(1));
  });
});
