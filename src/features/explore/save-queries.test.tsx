// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../app/api-client.ts", () => ({
  getExploreSaveState: vi.fn(),
  getSavedListings: vi.fn(),
  saveExploreListing: vi.fn(),
  unsaveExploreListing: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import {
  getSavedListings,
  saveExploreListing,
} from "../../app/api-client.ts";
import type { ExploreListingId } from "../../core/domain/ids.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import {
  exploreSaveKeys,
  useSavedListingsQuery,
  useToggleExploreSaveMutation,
} from "./save-queries.ts";

const mockSaved = vi.mocked(getSavedListings);
const mockSave = vi.mocked(saveExploreListing);
const mockUseSession = vi.mocked(useSessionQuery);

const listingId = "listing-1" as ExploreListingId;

const readySession = () =>
  mockUseSession.mockReturnValue({
    isSuccess: true,
    data: {
      participantId: "p-1",
      participantIds: ["p-1"],
      accountType: "REGISTERED",
      name: "u",
      isAuthenticated: true,
    },
  } as unknown as ReturnType<typeof useSessionQuery>);

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe("useSavedListingsQuery", () => {
  beforeEach(() => {
    mockSaved.mockReset();
    mockSave.mockReset();
    mockUseSession.mockReset();
  });

  it("세션 미준비면 요청하지 않는다", () => {
    mockUseSession.mockReturnValue({
      isSuccess: false,
      data: undefined,
    } as ReturnType<typeof useSessionQuery>);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSavedListingsQuery(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockSaved).not.toHaveBeenCalled();
  });

  it("세션 준비 후 첫 페이지를 요청한다", async () => {
    readySession();
    mockSaved.mockResolvedValue({ items: [], nextCursor: undefined });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSavedListingsQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSaved).toHaveBeenCalled();
  });
});

describe("useToggleExploreSaveMutation", () => {
  beforeEach(() => {
    mockSaved.mockReset();
    mockSave.mockReset();
    mockUseSession.mockReset();
    readySession();
  });

  it("성공 시 state cache를 서버 응답으로 확정하고 저장 목록을 invalidate한다", async () => {
    mockSave.mockResolvedValue({ saved: true });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useToggleExploreSaveMutation(listingId),
      { wrapper }
    );

    result.current.mutate({ nextSaved: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stateKey = exploreSaveKeys.state(listingId, "p-1");
    expect(queryClient.getQueryData(stateKey)).toEqual({ saved: true });
    // 저장 목록 invalidate 호출됨.
    const savedListKey = exploreSaveKeys.savedList("p-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: savedListKey });
  });

  it("실패 시 낙관적 값을 rollback한다(저장됨으로 확정하지 않음)", async () => {
    mockSave.mockRejectedValue(new Error("boom"));
    const { queryClient, wrapper } = makeWrapper();
    const stateKey = exploreSaveKeys.state(listingId, "p-1");
    // 초기 상태: 미저장.
    queryClient.setQueryData(stateKey, { saved: false });

    const { result } = renderHook(
      () => useToggleExploreSaveMutation(listingId),
      { wrapper }
    );

    result.current.mutate({ nextSaved: true });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // rollback: 다시 미저장으로 돌아간다.
    expect(queryClient.getQueryData(stateKey)).toEqual({ saved: false });
  });

  it("mutation invalidation이 Home과 /me/saved가 공유하는 저장 목록 query key에 도달한다 (RAON-256 DISC-9)", async () => {
    mockSave.mockResolvedValue({ saved: true });
    mockSaved.mockResolvedValue({ items: [], nextCursor: undefined });
    const { queryClient, wrapper } = makeWrapper();

    // Home/`/me/saved`가 실제로 등록하는 query key를 확인한다. 두 화면 모두
    // 동일한 `useSavedListingsQuery`(→ savedList(participantId) key, 같은 page
    // size)를 공유하므로 별도 page-size key를 도입하지 않는다.
    const listQuery = renderHook(() => useSavedListingsQuery(), { wrapper });
    await waitFor(() => expect(listQuery.result.current.isSuccess).toBe(true));

    const registeredKey = queryClient
      .getQueryCache()
      .findAll({ queryKey: exploreSaveKeys.savedList("p-1") })
      .map((q) => q.queryKey);
    // savedList(participantId)가 등록된 query key와 정확히 일치(공유 key)한다.
    expect(registeredKey).toContainEqual(exploreSaveKeys.savedList("p-1"));

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const mutation = renderHook(
      () => useToggleExploreSaveMutation(listingId),
      { wrapper }
    );
    mutation.result.current.mutate({ nextSaved: true });
    await waitFor(() => expect(mutation.result.current.isSuccess).toBe(true));

    // mutation은 savedList(participantId) key를 invalidate하고, 이 key는
    // 등록된 Home/`/me/saved` query와 prefix-매칭되어 refetch를 유발한다.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: exploreSaveKeys.savedList("p-1"),
    });
  });
});
