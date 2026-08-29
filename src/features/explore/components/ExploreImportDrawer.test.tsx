// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiClientModule from "../../../app/api-client.ts";

vi.mock("../../../app/api-client.ts", async (importActual) => {
  const actual = await importActual<typeof ApiClientModule>();
  return {
    ...actual,
    getTrips: vi.fn(),
    importExplorePlan: vi.fn(),
  };
});
vi.mock("../../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));
const navigate = vi.fn();
vi.mock("../../../hooks/useAppNavigation.ts", () => ({
  useAppNavigation: vi.fn(),
}));

import { ApiClientError, getTrips, importExplorePlan } from "../../../app/api-client.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import type { ExploreListingId } from "../../../core/domain/ids.ts";
import { useSessionQuery } from "../../../hooks/useSession.ts";
import { useAppNavigation } from "../../../hooks/useAppNavigation.ts";
import { ExploreImportDrawer } from "./ExploreImportDrawer.tsx";

const mockGetTrips = vi.mocked(getTrips);
const mockImport = vi.mocked(importExplorePlan);
const mockUseSession = vi.mocked(useSessionQuery);
const mockNav = vi.mocked(useAppNavigation);

const listingId = "listing-1" as ExploreListingId;

const room = (over: Record<string, unknown> = {}): TripRoom =>
  ({
    id: "trip-1",
    title: "제주 여행",
    destination: "제주",
    members: [{ id: "p-1", name: "나", role: "HOST" }],
    plans: [],
    revision: 7,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  }) as unknown as TripRoom;

const readySession = (accountType: "REGISTERED" | "GUEST" = "REGISTERED") =>
  ({
    isSuccess: true,
    data: {
      participantId: "p-1",
      participantIds: ["p-1"],
      accountType,
      name: "나",
      isAuthenticated: true,
    },
  }) as unknown as ReturnType<typeof useSessionQuery>;

const renderDrawer = (onClose = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = render(
    <ExploreImportDrawer listingId={listingId} isOpen onClose={onClose} />,
    { wrapper }
  );
  return { ...utils, onClose, queryClient };
};

const checkCopyConfirm = () => {
  fireEvent.click(
    screen.getByRole("checkbox", { name: /복사본으로 만들어지며/ })
  );
};

const selectOption = (name: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name }));
};

describe("ExploreImportDrawer (RAON-262 DISC-8)", () => {
  beforeEach(() => {
    mockGetTrips.mockReset();
    mockImport.mockReset();
    mockUseSession.mockReset();
    mockNav.mockReset();
    navigate.mockReset();
    mockNav.mockReturnValue({
      navigate,
      goBack: vi.fn(),
      location: { pathname: "/explore/listing-1" },
      platformNavigation: undefined,
    } as unknown as ReturnType<typeof useAppNavigation>);
    mockUseSession.mockReturnValue(readySession());
    mockGetTrips.mockResolvedValue([room()]);
  });

  it("NEW_TRIP payload로 import를 호출하고 성공 후에만 navigate한다", async () => {
    mockImport.mockResolvedValue({
      tripId: "trip-9" as never,
      planId: "plan-9" as never,
    });
    renderDrawer();

    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    await waitFor(() =>
      expect(mockImport).toHaveBeenCalledWith(listingId, { type: "NEW_TRIP" })
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/trips/trip-9/plans/plan-9")
    );
  });

  it("tripRoomKeys.all invalidation이 끝난 뒤에만 navigate한다(진행 중엔 navigate 없음)", async () => {
    // import API는 즉시 resolve하지만, onSuccess의 invalidateQueries를 deferred로
    // 붙잡아 캐시 무효화가 pending인 동안 navigate가 발사되지 않음을 증명한다.
    // onSuccess가 invalidation을 더 이상 await하지 않으면 이 테스트는 실패한다.
    mockImport.mockResolvedValue({
      tripId: "trip-9" as never,
      planId: "plan-9" as never,
    });

    const { queryClient } = renderDrawer();

    let resolveInvalidate: () => void = () => {};
    const invalidatePending = new Promise<void>((resolve) => {
      resolveInvalidate = resolve;
    });
    const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation(async (filters?: unknown) => {
        // trip-rooms invalidation만 deferred로 붙잡는다.
        const key = (filters as { queryKey?: readonly unknown[] } | undefined)
          ?.queryKey;
        if (Array.isArray(key) && key[0] === "trip-rooms") {
          await invalidatePending;
          return;
        }
        return originalInvalidate(filters as never);
      });

    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    // import는 이미 호출됐고 invalidation이 시작됐지만 아직 pending이다.
    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["trip-rooms"] })
      )
    );
    // invalidation이 끝나기 전에는 navigate가 발사되면 안 된다.
    expect(navigate).not.toHaveBeenCalled();

    // 캐시 무효화가 끝나면 비로소 navigate한다.
    resolveInvalidate();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/trips/trip-9/plans/plan-9")
    );

    invalidateSpy.mockRestore();
  });

  it("EXISTING_TRIP은 제출 직전 refetch한 최신 revision으로 payload를 만든다", async () => {
    // 최초 로드 revision=7, 제출 직전 refetch에서 revision=9로 바뀐다.
    mockGetTrips
      .mockResolvedValueOnce([room({ revision: 7 })])
      .mockResolvedValue([room({ revision: 9 })]);
    mockImport.mockResolvedValue({
      tripId: "trip-1" as never,
      planId: "plan-2" as never,
    });
    renderDrawer();

    selectOption(/기존 여행에 추가/);
    await screen.findByRole("radio", { name: /제주 여행/ });
    selectOption(/제주 여행/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    await waitFor(() =>
      expect(mockImport).toHaveBeenCalledWith(listingId, {
        type: "EXISTING_TRIP",
        tripId: "trip-1",
        expectedRevision: 9,
      })
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/trips/trip-1/plans/plan-2")
    );
  });

  it("확정된 방은 후보에서 제외한다", async () => {
    mockGetTrips.mockResolvedValue([
      room({ id: "trip-1", title: "고르는중여행", destination: "" }),
      room({
        id: "trip-2",
        title: "완료된여행",
        destination: "",
        confirmedPlanId: "plan-c",
        plans: [{ id: "plan-c", status: "CONFIRMED" }],
      }),
    ]);
    renderDrawer();
    selectOption(/기존 여행에 추가/);
    await screen.findByRole("radio", { name: /고르는중여행/ });
    expect(
      screen.queryByRole("radio", { name: /완료된여행/ })
    ).not.toBeInTheDocument();
  });

  it("대상 미선택/미확인 시 import를 호출하지 않는다(submit 비활성)", async () => {
    renderDrawer();
    // 옵션/확인 없음 → submit disabled
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
    selectOption(/새 여행 만들기/);
    // 아직 복사 확인 안 함 → 여전히 disabled
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
    expect(mockImport).not.toHaveBeenCalled();
  });

  it("guest는 NEW 옵션이 비활성화되고 안내 문구를 노출한다", () => {
    mockUseSession.mockReturnValue(readySession("GUEST"));
    renderDrawer();
    // Base UI radio는 aria-disabled/data-disabled로 비활성 상태를 노출한다.
    expect(
      screen.getByRole("radio", { name: /새 여행 만들기/ })
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/계정 연결\(로그인\)이 필요해요/)).toBeVisible();
  });

  it("pending 중에는 submit이 중복 호출되지 않는다", async () => {
    let resolveImport: (v: { tripId: never; planId: never }) => void = () => {};
    mockImport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    const submit = screen.getByRole("button", { name: /가져오기|가져오는 중/ });
    fireEvent.click(submit);
    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    // pending 동안 다시 눌러도 재호출되지 않는다.
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mockImport).toHaveBeenCalledTimes(1);
    resolveImport({ tripId: "t" as never, planId: "p" as never });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it("같은 event loop에서 연속 클릭해도 정확히 한 번만 import를 호출한다(동기 lock)", async () => {
    // state 기반 isPending은 re-render 이후에만 반영된다. 같은 act(=같은 flush)
    // 안에서 두 번 클릭하면 첫 클릭의 state 반영 이전이라 state 방어가 뚫릴 수 있다.
    // 동기 lock ref가 이를 막아 정확히 한 번만 mutation을 발사한다.
    let resolveImport: (v: { tripId: never; planId: never }) => void = () => {};
    mockImport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    const submit = screen.getByRole("button", { name: /가져오기|가져오는 중/ });
    // 단일 flush 안에서 두 개의 native click을 연속 dispatch한다.
    // (fireEvent는 매 호출마다 flush하므로 재호출 방어를 우회하지 못한다.)
    act(() => {
      submit.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      submit.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });
    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    expect(mockImport).toHaveBeenCalledTimes(1);
    resolveImport({ tripId: "t" as never, planId: "p" as never });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it("EXISTING preflight 실패 후 lock이 풀려 재시도가 가능하다", async () => {
    // 첫 제출 직전 refetch는 실패시키고(=import 미호출, preflightError, lock 해제),
    // 이후 refetch는 성공시켜 재시도가 정상 동작함을 증명한다. 자동 refetch 등
    // 호출 순서에 의존하지 않도록 flag로 refetch 실패 구간을 제어한다.
    let failRefetch = false;
    let loaded = false;
    mockGetTrips.mockImplementation(async () => {
      if (loaded && failRefetch) {
        throw new Error("net");
      }
      loaded = true;
      return [room({ id: "trip-1", title: "제주 여행", revision: 11 })];
    });
    mockImport.mockResolvedValue({
      tripId: "trip-1" as never,
      planId: "plan-2" as never,
    });
    renderDrawer();

    selectOption(/기존 여행에 추가/);
    await screen.findByRole("radio", { name: /제주 여행/ });
    selectOption(/제주 여행/);
    checkCopyConfirm();

    // 제출 직전 refetch를 실패시킨다.
    failRefetch = true;
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    // preflight 실패 문구를 노출하고 import는 호출하지 않는다.
    expect(
      await screen.findByText(/다시 불러오지 못했어요/)
    ).toBeVisible();
    expect(mockImport).not.toHaveBeenCalled();

    // lock이 풀렸으므로, refetch가 다시 성공하면 재시도 시 import가 호출된다.
    failRefetch = false;
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    await waitFor(() =>
      expect(mockImport).toHaveBeenCalledWith(listingId, {
        type: "EXISTING_TRIP",
        tripId: "trip-1",
        expectedRevision: 11,
      })
    );
  });

  it("mutation 실패 시 navigate하지 않는다", async () => {
    mockImport.mockRejectedValue(new Error("boom"));
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    await screen.findByRole("alert");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("409는 목록 새로고침 복구를 제공한다", async () => {
    mockImport.mockRejectedValue(
      new ApiClientError({ status: 409, message: "c", code: "REVISION_CONFLICT" })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/먼저 여행을 변경했어요/);
    expect(
      within(alert).getByRole("button", { name: "목록 새로고침" })
    ).toBeVisible();
  });

  it("403은 권한 안내 + 다른 여행 선택 복구를 제공한다", async () => {
    mockImport.mockRejectedValue(
      new ApiClientError({ status: 403, message: "f", code: "FORBIDDEN" })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/권한이 없어요/);
  });

  it("403 ACCOUNT_UPGRADE_REQUIRED는 계정 연결 안내로 구분한다(권한 문구 아님)", async () => {
    mockImport.mockRejectedValue(
      new ApiClientError({
        status: 403,
        message: "u",
        code: "ACCOUNT_UPGRADE_REQUIRED",
      })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/계정 연결이 필요해요/);
    // 권한/후보 새로고침 복구 문구/버튼을 노출하지 않는다.
    expect(alert).not.toHaveTextContent(/권한이 없어요/);
    expect(
      within(alert).queryByRole("button", { name: "목록 새로고침" })
    ).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("404(TripRoom)는 재선택, 404(ExplorePlanListing)는 탐색 복귀로 구분한다", async () => {
    mockImport.mockRejectedValueOnce(
      new ApiClientError({
        status: 404,
        message: "nf",
        code: "NOT_FOUND",
        details: { entity: "TripRoom", id: "trip-1" },
      })
    );
    const { rerender } = renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    let alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/여행을 찾을 수 없어요/);

    // ExplorePlanListing 404 → 탐색으로 가기
    mockImport.mockReset();
    mockImport.mockRejectedValue(
      new ApiClientError({
        status: 404,
        message: "nf",
        code: "NOT_FOUND",
        details: { entity: "ExplorePlanListing", id: listingId },
      })
    );
    rerender(
      <ExploreImportDrawer listingId={listingId} isOpen onClose={vi.fn()} />
    );
    // 재제출
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/더 이상 찾을 수 없어요/);
    within(alert).getByRole("button", { name: "탐색으로 가기" }).click();
    expect(navigate).toHaveBeenCalledWith("/explore");
  });

  it("410은 게시 중단 안내 + 탐색 복귀를 제공한다", async () => {
    mockImport.mockRejectedValue(
      new ApiClientError({ status: 410, message: "g", code: "LISTING_UNAVAILABLE" })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/공개가 중단된/);
    expect(
      within(alert).getByRole("button", { name: "탐색으로 가기" })
    ).toBeVisible();
  });

  it("422는 불완전 snapshot으로 가져올 수 없음을 안내한다", async () => {
    mockImport.mockRejectedValue(
      new ApiClientError({ status: 422, message: "v", code: "VALIDATION_FAILED" })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/정보가 완전하지 않아/);
  });

  it("5xx는 재시도 안내만 하고 navigate하지 않는다", async () => {
    mockImport.mockRejectedValue(
      new ApiClientError({ status: 503, message: "down" })
    );
    renderDrawer();
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/잠시 후 다시 시도/);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rooms query 오류는 정직한 오류 상태 + 재시도를 제공한다", async () => {
    mockGetTrips.mockRejectedValue(new Error("net"));
    renderDrawer();
    selectOption(/기존 여행에 추가/);
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByRole("button", { name: "다시 시도" })
    ).toBeVisible();
  });

  it("추가할 수 있는 여행이 없으면 정직한 empty 상태를 노출한다", async () => {
    mockGetTrips.mockResolvedValue([]);
    renderDrawer();
    selectOption(/기존 여행에 추가/);
    expect(
      await screen.findByText(/추가할 수 있는 여행이 없어요/)
    ).toBeVisible();
  });

  it("EXISTING 제출 직전 refetch에서 방이 확정되면 import를 호출하지 않는다", async () => {
    mockGetTrips
      .mockResolvedValueOnce([room({ id: "trip-1", title: "제주 여행" })])
      .mockResolvedValue([
        room({
          id: "trip-1",
          title: "제주 여행",
          confirmedPlanId: "plan-c",
          plans: [{ id: "plan-c", status: "CONFIRMED" }],
        }),
      ]);
    renderDrawer();
    selectOption(/기존 여행에 추가/);
    await screen.findByRole("radio", { name: /제주 여행/ });
    selectOption(/제주 여행/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/더 이상 사용할 수 없어요/);
    expect(mockImport).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("복사 semantics를 drawer 접근 가능한 description과 확인 체크박스로 노출한다", () => {
    renderDrawer();
    // Drawer accessible description(복사/자동 업데이트 안됨)
    expect(screen.getByText(/자동으로 업데이트되지 않아요/)).toBeVisible();
    // required 확인 체크박스 문구
    expect(
      screen.getByRole("checkbox", { name: /복사본으로 만들어지며/ })
    ).toBeVisible();
  });

  it("pending이 아닐 때 Escape로 닫으면 onClose를 호출한다(포커스 복원은 Drawer 소유)", async () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    // Base UI Drawer는 Escape를 onOpenChange(false)로 처리한다.
    fireEvent.keyDown(
      screen.getByRole("button", { name: "가져오기" }),
      { key: "Escape" }
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("pending 중에는 Escape dismiss가 막혀 onClose를 호출하지 않는다", async () => {
    let resolveImport: (v: { tripId: never; planId: never }) => void = () => {};
    mockImport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        })
    );
    const onClose = vi.fn();
    renderDrawer(onClose);
    selectOption(/새 여행 만들기/);
    checkCopyConfirm();
    fireEvent.click(screen.getByRole("button", { name: /가져오기|가져오는 중/ }));
    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    onClose.mockClear();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /가져오는 중/ }),
      { key: "Escape" }
    );
    expect(onClose).not.toHaveBeenCalled();
    resolveImport({ tripId: "t" as never, planId: "p" as never });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it("좁은 화면(반응형) drawer 본문/옵션이 min-w-0로 overflow를 방지한다", () => {
    renderDrawer();
    // Drawer content는 portal로 렌더되므로 document 기준으로 조회한다(320~430 smoke).
    const drawer = document.body.querySelector(
      '[data-slot="explore-import-drawer"]'
    );
    expect(drawer).not.toBeNull();
    const submit = document.body.querySelector(
      '[data-slot="explore-import-submit"]'
    );
    expect(submit).not.toBeNull();
    // 좁은 폭에서 텍스트가 넘치지 않도록 옵션/텍스트 노드가 min-w-0를 유지한다.
    const minWidthNodes = document.body.querySelectorAll(".min-w-0");
    expect(minWidthNodes.length).toBeGreaterThan(0);
  });
});
