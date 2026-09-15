// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { createTripResource, deleteTripResource } from "../../app/api-client.ts";
import type * as ApiClient from "../../app/api-client.ts";
import type { TripResourceResponse, TripResourcesResponse } from "../../contracts/trip-resource.ts";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../../core/domain/ids.ts";
import { sessionKeys } from "../../hooks/useSession.ts";
import { resourceKeys, useTripResourceMutation } from "./queries.ts";

vi.mock("../../app/api-client.ts", async (importOriginal) => ({
  ...await importOriginal<typeof ApiClient>(),
  createTripResource: vi.fn<typeof createTripResource>(),
  deleteTripResource: vi.fn<typeof deleteTripResource>(),
}));

it("서버 저장 결과를 중복 없이 반영하고 다른 멤버의 권한 캐시를 덮어쓰지 않는다", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const resource: TripResourceResponse = {
    id: "347cccd6-2a28-414d-9dc4-e2ddc00cc123",
    tripId: TripIdSchema.make("trip-resources"),
    createdBy: ParticipantIdSchema.make("member-a"),
    createdByName: "가영", createdAt: "2026-09-16T00:00:00Z", updatedAt: "2026-09-16T00:00:00Z",
    revision: RevisionSchema.make(1), url: "", note: "함께 볼 여행 메모", places: null,
    processedAt: null, linkStatus: "NOT_READ", canManage: true,
  };
  client.setQueryData(sessionKeys.current(), { participantId: "member-a" });
  const currentKey = resourceKeys.list(resource.tripId, "member-a");
  const otherKey = resourceKeys.list(resource.tripId, "member-b");
  // 저장 응답보다 먼저 같은 자료가 polling에 나타난 경우도 한 번만 표시한다.
  client.setQueryData(currentKey, { items: [resource], extractionAvailable: true });
  client.setQueryData(otherKey, { items: [{ ...resource, canManage: false }], extractionAvailable: true });
  vi.mocked(createTripResource).mockResolvedValue(resource);
  vi.mocked(deleteTripResource).mockResolvedValue({ deleted: true });
  const { result } = renderHook(() => useTripResourceMutation(resource.tripId), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  await act(async () => { await result.current.mutateAsync({ type: "create", input: { url: "", note: resource.note } }); });
  expect(client.getQueryData<TripResourcesResponse>(currentKey)?.items).toEqual([resource]);
  expect(client.getQueryData<TripResourcesResponse>(otherKey)?.items[0]?.canManage).toBe(false);
  await act(async () => { await result.current.mutateAsync({ type: "delete", resourceId: resource.id, expectedRevision: 1 }); });
  expect(client.getQueryData<TripResourcesResponse>(currentKey)?.items).toEqual([]);
  expect(deleteTripResource).toHaveBeenCalledWith(resource.tripId, resource.id, 1);
  client.clear();
});
