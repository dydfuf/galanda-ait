// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="location-pathname">{location.pathname}</span>
      <button
        type="button"
        data-testid="test-back-btn"
        onClick={() => navigate(-1)}
      >
        뒤로
      </button>
    </div>
  );
}

const renderLayout = (
  initialEntries: string[] | string = "/trips/trip-1/plans",
  initialIndex = 0,
) =>
  render(
    <MemoryRouter
      initialEntries={Array.isArray(initialEntries) ? initialEntries : [initialEntries]}
      initialIndex={initialIndex}
    >
      <LocationProbe />
      <Routes>
        <Route path="/trips" element={<h1>여행 목록 콘텐츠</h1>} />
        <Route path="/trips/:tripId" element={<TripRoomTabLayout />}>
          <Route path="plans" element={<h1>계획 콘텐츠</h1>} />
          <Route path="itinerary" element={<h1>일정 콘텐츠</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

function createNativeNavigation(
  addAccessoryButton: PlatformNavigation["addAccessoryButton"] = vi
    .fn<PlatformNavigation["addAccessoryButton"]>()
    .mockResolvedValue(undefined),
) {
  let onInsetChange: ((inset: number) => void) | undefined;
  const removeInsetListener = vi.fn<VoidFunction>();
  const navigation: PlatformNavigation = {
    contentTopInset: 54,
    subscribeContentTopInset: vi.fn<
      PlatformNavigation["subscribeContentTopInset"]
    >((onChange) => {
      onInsetChange = onChange;
      return removeInsetListener;
    }),
    addAccessoryButton,
    removeAccessoryButton: vi.fn<VoidFunction>(),
  };

  return {
    emitInset: (inset: number) => onInsetChange?.(inset),
    navigation,
    removeInsetListener,
  };
}

function expectPlansTabSelected() {
  expect(screen.getByRole("tab", { name: "계획" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
}

describe("TripRoomTabLayout platform shell ownership (RAON-229)", () => {
  beforeEach(() => {
    mocks.platform.navigation = undefined;
    vi.clearAllMocks();
  });

  it("Web/PWA owns one sticky chrome for safe-area back, title, share, and Mode Tab", () => {
    const { container } = renderLayout();

    const header = screen.getByRole("banner");
    expect(header.className).toContain("pt-(--safe-top)");
    expect(
      within(header).getByRole("button", { name: "뒤로 가기" }),
    ).toBeInTheDocument();
    expect(within(header).getByText("여행방")).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "여행 초대 링크 공유" }),
    ).toBeInTheDocument();

    const tablist = screen.getByRole("tablist", { name: "여행방 화면" });
    const chromeOwner = header.parentElement;
    expect(tablist).toHaveAttribute("data-variant", "chrome");
    expect(header).not.toHaveAttribute("data-galanda-surface");
    expect(tablist).not.toHaveAttribute("data-galanda-surface");
    expect(chromeOwner).toHaveAttribute("data-galanda-surface", "chrome");
    expect(chromeOwner?.className).toContain("sticky");
    expect(chromeOwner?.className).toContain("border-b");
    expect(
      container.querySelectorAll('[data-galanda-surface="chrome"]'),
    ).toHaveLength(1);
    expectPlansTabSelected();
    expect(
      screen.getByRole("heading", { level: 1, name: "계획 콘텐츠" }),
    ).toBeInTheDocument();
  });

  it("AIT keeps one web chrome below native navigation and applies its inset once", async () => {
    const { emitInset, navigation, removeInsetListener } =
      createNativeNavigation();
    mocks.platform.navigation = navigation;

    const { container, unmount } = renderLayout();

    const header = screen.getByRole("banner");
    const tablist = screen.getByRole("tablist", { name: "여행방 화면" });
    expect(header).toHaveStyle({ paddingTop: "54px" });
    expect(header.className).not.toContain("pt-(--safe-top)");
    expect(container.querySelectorAll('[style*="padding-top"]')).toHaveLength(
      1,
    );
    expect(container.querySelector('[style*="padding-top"]')).toBe(header);
    expect(
      within(header).queryByRole("button", { name: "뒤로 가기" }),
    ).not.toBeInTheDocument();
    expect(within(header).queryByText("여행방")).not.toBeInTheDocument();
    expect(
      within(header).queryByRole("button", { name: "여행 초대 링크 공유" }),
    ).not.toBeInTheDocument();
    expect(header).toContainElement(tablist);
    expect(header).toHaveAttribute("data-galanda-surface", "chrome");
    expect(tablist).toHaveAttribute("data-variant", "chrome");
    expect(tablist).not.toHaveAttribute("data-galanda-surface");
    expect(
      container.querySelectorAll('[data-galanda-surface="chrome"]'),
    ).toHaveLength(1);
    expectPlansTabSelected();

    await waitFor(() =>
      expect(navigation.addAccessoryButton).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "galanda-share-invite",
          title: "공유",
          iconName: "icon-share-mono",
          callback: expect.any(Function),
        }),
      ),
    );

    act(() => emitInset(72));
    expect(header).toHaveStyle({ paddingTop: "72px" });
    expect(container.querySelectorAll('[style*="padding-top"]')).toHaveLength(
      1,
    );

    unmount();
    expect(removeInsetListener).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(navigation.removeAccessoryButton).toHaveBeenCalledTimes(1),
    );
  });

  it("AIT keeps native back/title ownership but uses the reserved web share slot when accessory registration rejects", async () => {
    let rejectRegistration: (reason?: unknown) => void = () => undefined;
    const registration = new Promise<void>((_resolve, reject) => {
      rejectRegistration = reject;
    });
    const addAccessoryButton = vi
      .fn<PlatformNavigation["addAccessoryButton"]>()
      .mockReturnValue(registration);
    const { navigation } = createNativeNavigation(addAccessoryButton);
    mocks.platform.navigation = navigation;

    const { container } = renderLayout();

    const header = screen.getByRole("banner");
    expect(
      within(header).queryByRole("button", { name: "여행 초대 링크 공유" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      rejectRegistration(new Error("native accessory unavailable"));
      await registration.catch(() => undefined);
    });

    const fallbackShare = within(header).getByRole("button", {
      name: "여행 초대 링크 공유",
    });
    const reservedActionSlot = header.firstElementChild?.lastElementChild;
    expect(reservedActionSlot).toContainElement(fallbackShare);
    expect(
      within(header).queryByRole("button", { name: "뒤로 가기" }),
    ).not.toBeInTheDocument();
    expect(within(header).queryByText("여행방")).not.toBeInTheDocument();
    expect(header).toHaveStyle({ paddingTop: "54px" });
    expect(header.className).not.toContain("pt-(--safe-top)");
    expect(header).toContainElement(
      screen.getByRole("tablist", { name: "여행방 화면" }),
    );
    expect(
      container.querySelectorAll('[data-galanda-surface="chrome"]'),
    ).toHaveLength(1);
    expectPlansTabSelected();
  });

  it("selects the itinerary Mode Tab for a trailing-slash direct entry", () => {
    renderLayout("/trips/trip-1/itinerary/");

    expect(screen.getByRole("tab", { name: "계획" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "일정 콘텐츠" }),
    ).toBeInTheDocument();
  });

  it("selects the plans Mode Tab for direct entry with and without trailing slash", () => {
    const { unmount } = renderLayout("/trips/trip-1/plans");
    expectPlansTabSelected();
    expect(
      screen.getByRole("heading", { level: 1, name: "계획 콘텐츠" }),
    ).toBeInTheDocument();
    unmount();

    renderLayout("/trips/trip-1/plans/");
    expectPlansTabSelected();
    expect(
      screen.getByRole("heading", { level: 1, name: "계획 콘텐츠" }),
    ).toBeInTheDocument();
  });

  it("계획 → 일정 탭 전환 시 URL이 바뀌고 일정 콘텐츠가 렌더링된다", () => {
    renderLayout("/trips/trip-1/plans");

    expectPlansTabSelected();
    expect(
      screen.getByRole("heading", { level: 1, name: "계획 콘텐츠" }),
    ).toBeInTheDocument();

    const itineraryTab = screen.getByRole("tab", { name: "일정" });
    fireEvent.click(itineraryTab);

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/itinerary",
    );
    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "계획" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "일정 콘텐츠" }),
    ).toBeInTheDocument();
  });

  it("일정 → 계획 탭 전환 시 URL이 바뀌고 계획 콘텐츠가 렌더링된다", () => {
    renderLayout("/trips/trip-1/itinerary");

    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const plansTab = screen.getByRole("tab", { name: "계획" });
    fireEvent.click(plansTab);

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/plans",
    );
    expectPlansTabSelected();
    expect(
      screen.getByRole("heading", { level: 1, name: "계획 콘텐츠" }),
    ).toBeInTheDocument();
  });

  it("탭 전환 시 replace: true 계약이 유지되어 browser back 실행 시 이전 진입점(/trips)으로 복귀한다", () => {
    renderLayout(["/trips", "/trips/trip-1/plans"], 1);

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/plans",
    );

    // 일정 탭으로 전환 (replace: true)
    const itineraryTab = screen.getByRole("tab", { name: "일정" });
    fireEvent.click(itineraryTab);

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/itinerary",
    );

    // Back 실행
    fireEvent.click(screen.getByTestId("test-back-btn"));

    // /trips/trip-1/plans 가 아닌 /trips 로 복귀해야 한다
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/trips");
    expect(
      screen.getByRole("heading", { level: 1, name: "여행 목록 콘텐츠" }),
    ).toBeInTheDocument();
  });

  it("TripRoomTabLayout 단위에서는 Global nav가 렌더되지 않는다", () => {
    renderLayout("/trips/trip-1/plans");
    expect(
      screen.queryByRole("navigation", { name: "주요 화면" }),
    ).not.toBeInTheDocument();
  });
});
