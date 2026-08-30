// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type {
  TripPlan,
  TripRoom,
  UserSession,
} from "../../core/domain/room.ts";
import type { PlatformNavigation } from "../../platform/types.ts";

const mocks = vi.hoisted(() => ({
  useAppNavigation: vi.fn<(...args: unknown[]) => unknown>(),
  useTripRoomRawQuery: vi.fn<(...args: unknown[]) => unknown>(),
  useSessionQuery: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("../../hooks/useAppNavigation.ts", () => ({
  useAppNavigation: mocks.useAppNavigation,
}));
vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomRawQuery: mocks.useTripRoomRawQuery,
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: mocks.useSessionQuery,
}));
vi.mock("../invite/share-trip-invite.ts", () => ({
  shareTripInvite: vi.fn<(...args: unknown[]) => unknown>(),
}));

import type { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import type { useSessionQuery } from "../../hooks/useSession.ts";
import { shareTripInvite } from "../invite/share-trip-invite.ts";
import type { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { TripCompanionSetupPage } from "./TripCompanionSetupPage.tsx";

const mockShareTripInvite = vi.mocked(shareTripInvite);
const setupPath = "/trips/trip-created/setup/companions";
const hostId = ParticipantIdSchema.make("participant-host");

const room: TripRoom = {
  id: TripIdSchema.make("trip-created"),
  title: "봄 여행",
  destination: "",
  revision: RevisionSchema.make(1),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const existingPlan: TripPlan = {
  id: PlanIdSchema.make("plan-existing"),
  title: "기존 여행안",
  proposalReason: "",
  baseHeadcount: 1,
  routes: [],
  accommodations: [],
  transports: [],
  places: [],
  status: "VOTING",
  authorId: hostId,
  authorName: "방장",
  voteCount: 0,
};

const session: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

const roomQueryResult = (
  data: TripRoom | undefined = room,
  overrides: Record<string, unknown> = {},
): ReturnType<typeof useTripRoomRawQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  }) as unknown as ReturnType<typeof useTripRoomRawQuery>;

const sessionQueryResult = (
  data: UserSession | null = session,
  overrides: Record<string, unknown> = {},
): ReturnType<typeof useSessionQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  }) as unknown as ReturnType<typeof useSessionQuery>;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={[setupPath]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/trips/:tripId/setup/companions"
          element={<TripCompanionSetupPage />}
        />
        <Route path="*" element={<p>이동 완료</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = () => render(<TestApp />);

beforeEach(() => {
  mocks.useAppNavigation.mockReset();
  mocks.useTripRoomRawQuery.mockReset();
  mocks.useSessionQuery.mockReset();
  mockShareTripInvite.mockReset();

  mocks.useAppNavigation.mockReturnValue({
    platformNavigation: undefined,
  } as unknown as ReturnType<typeof useAppNavigation>);
  mocks.useTripRoomRawQuery.mockReturnValue(roomQueryResult());
  mocks.useSessionQuery.mockReturnValue(sessionQueryResult());
  mockShareTripInvite.mockResolvedValue("copied");
});

describe("TripCompanionSetupPage", () => {
  it("실제 room host에게만 link share를 제공하는 접근 가능한 2단계 화면을 렌더링한다", () => {
    const { container } = renderPage();

    expect(mocks.useTripRoomRawQuery).toHaveBeenCalledWith("trip-created");
    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("2/7");
    expect(progress).toHaveTextContent("동행자");
    expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent(
      "2. 동행자 현재 단계",
    );
    expect(
      screen.getByRole("button", { name: "초대 링크 공유하기" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "미정으로 두고 다음",
      }),
    ).toBeEnabled();
    expect(container).not.toHaveTextContent(/이메일 초대|권한 선택|AI 추천/);
  });

  it("공유 중에는 중복 요청과 skip 이동을 막고 결과 이후에만 계속한다", async () => {
    const request = deferred<"copied">();
    mockShareTripInvite.mockReturnValue(request.promise);
    renderPage();

    const shareButton = screen.getByRole("button", {
      name: "초대 링크 공유하기",
    });
    fireEvent.click(shareButton);
    fireEvent.click(shareButton);

    expect(mockShareTripInvite).toHaveBeenCalledTimes(1);
    expect(mockShareTripInvite).toHaveBeenCalledWith("trip-created");
    expect(
      screen.getByRole("button", { name: "초대 링크 준비 중..." }),
    ).toBeDisabled();
    const continueButton = screen.getByRole("button", {
      name: "미정으로 두고 다음",
    });
    expect(continueButton).toBeDisabled();
    fireEvent.click(continueButton);
    expect(screen.getByTestId("location-path")).toHaveTextContent(setupPath);

    await act(async () => {
      request.resolve("copied");
      await request.promise;
    });

    expect(await screen.findByText("초대 링크를 복사했어요.")).toBeVisible();
    const completedButton = screen.getByRole("button", {
      name: "다음: 기본 정보",
    });
    expect(completedButton).toBeEnabled();
    fireEvent.click(completedButton);

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/trips/trip-created/plans/new/basic",
      ),
    );
  });

  it("공유하지 않아도 명시적인 skip으로 첫 여행안 작성 route에 이동한다", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "미정으로 두고 다음",
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/trips/trip-created/plans/new/basic",
      ),
    );
    expect(mockShareTripInvite).not.toHaveBeenCalled();
  });

  it("존재하지 않거나 읽을 수 없는 room에서는 setup action을 노출하지 않는다", () => {
    mocks.useTripRoomRawQuery.mockReturnValue(
      roomQueryResult(undefined, { isError: true, error: new Error("not found") }),
    );

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행방을 확인할 수 없어요",
    );
    expect(
      screen.queryByRole("navigation", { name: "여행 만들기 진행 단계" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "초대 링크 공유하기" }),
    ).not.toBeInTheDocument();
  });

  it("이미 첫 여행안이 있는 room에서는 setup 단계를 다시 노출하지 않는다", () => {
    mocks.useTripRoomRawQuery.mockReturnValue(
      roomQueryResult({ ...room, plans: [existingPlan] }),
    );

    renderPage();

    expect(screen.getByText("여행 만들기 단계가 끝났어요")).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "여행 만들기 진행 단계" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "초대 링크 공유하기" }),
    ).not.toBeInTheDocument();
  });

  it("room member deep link에는 host 전용 setup을 표시하지 않는다", () => {
    const memberId = ParticipantIdSchema.make("participant-member");
    mocks.useTripRoomRawQuery.mockReturnValue(
      roomQueryResult({
        ...room,
        members: [{ id: memberId, name: "멤버", role: "MEMBER" }],
      }),
    );
    mocks.useSessionQuery.mockReturnValue(
      sessionQueryResult({
        ...session,
        participantId: memberId,
        participantIds: [memberId],
        name: "멤버",
      }),
    );

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행 설정 권한이 없어요",
    );
    expect(
      screen.queryByRole("button", { name: "초대 링크 공유하기" }),
    ).not.toBeInTheDocument();
    expect(mockShareTripInvite).not.toHaveBeenCalled();
  });

  it("AIT navigation inset을 본문에 한 번 반영하고 변경 구독을 정리한다", () => {
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
      addAccessoryButton: vi.fn<PlatformNavigation["addAccessoryButton"]>(),
      removeAccessoryButton: vi.fn<PlatformNavigation["removeAccessoryButton"]>(),
    };
    mocks.useAppNavigation.mockReturnValue({
      platformNavigation: navigation,
    } as unknown as ReturnType<typeof useAppNavigation>);

    const { container, unmount } = renderPage();

    expect(container.querySelector("header")).toBeNull();
    const body = container.querySelector<HTMLElement>(
      '[data-slot="trip-companion-setup-body"]',
    );
    expect(body).toHaveStyle({
      paddingTop: "calc(var(--app-page-padding-top) + 54px)",
    });

    act(() => onInsetChange?.(72));
    expect(body).toHaveStyle({
      paddingTop: "calc(var(--app-page-padding-top) + 72px)",
    });

    unmount();
    expect(removeInsetListener).toHaveBeenCalledTimes(1);
  });
});
