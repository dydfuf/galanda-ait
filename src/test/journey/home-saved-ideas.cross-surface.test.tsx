// @vitest-environment jsdom
/**
 * Cross-surface release journey (RAON-258 / Goal 14 DISC-10, Journey 2 UI leg).
 *
 * 이 테스트는 나머지 in-process journey(`worker/journey/release-journeys.test.ts`)가
 * API 경계에서 증명한 save→saved-list read-through를, **실제 React Query 컴포넌트 +
 * jsdom render**로 한 단계 더 이어 붙인다(cross-surface stitch). 아래를 그대로
 * 통과시킨다:
 *
 *   실제 `SavedIdeasSection` (Home)  ← RAON-256 DISC-9
 *     → 실제 `useSavedListingsQuery` / `useSessionQuery` (React Query)
 *     → 실제 api-client `fetch("/api/me/saved")` / `fetch("/api/session")`
 *     → routeFetchToApp가 globalThis.fetch를 production `app.fetch`로 라우팅
 *     → 실제 Hono route + Effect use case + Drizzle repository가 만든 실제 SQL
 *     → in-process stateful harness store
 *
 * production 컴포넌트/훅/클라이언트/라우트를 mock하지 않는다. 유일한 대체 지점은
 * harness의 pg wire(in-memory)와 request header로 세션을 지정하는 주입된 auth뿐이다.
 * fake image/count/popularity를 만들지 않으며, 저장한 적 없는 세션에는 아무 카드도
 * 렌더하지 않는다(정직한 empty 상태). 저장 상태는 세션(actor)별로 격리된다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SavedIdeasSection } from "@/features/home/components/SavedIdeasSection.tsx";
import {
  createJourneyHarness,
  listedListing,
  privateRoom,
  publishablePlan,
  routeFetchToApp,
  type JourneyHarness,
} from "./worker-harness-bridge.js";

const AUTHOR = { id: "author-1", name: "여행작가" };
const VIEWER = { id: "viewer-1", name: "구경꾼" };

let restoreFetch: (() => void) | undefined;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = undefined;
});

const renderSavedIdeasAs = (harness: JourneyHarness, participantId: string) => {
  // retry off: 401/오류가 무한 재시도되지 않도록(운영 QueryClient와 동일한 의도).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const routed = routeFetchToApp(harness, participantId);
  restoreFetch = routed.restore;
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SavedIdeasSection />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...rendered, queryClient };
};

describe("Cross-surface Journey 2: Home 저장한 여행 아이디어 (real React Query → app.fetch)", () => {
  it("저장한 listing이 실제 API를 통해 Home 카드로 렌더되고 private ID를 노출하지 않는다", async () => {
    const tripId = "trip-x";
    const planId = "plan-x";
    const listingId = "listing-x";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({
              planId,
              authorId: AUTHOR.id,
              authorName: AUTHOR.name,
            }),
          ],
        }),
      ],
      exploreListings: [
        listedListing({
          listingId,
          sourceTripId: tripId,
          sourcePlanId: planId,
          sourceAuthorParticipantId: AUTHOR.id,
          title: "오사카 벚꽃 여행",
        }),
      ],
    });

    // 실제 save route를 먼저 실행하고, 같은 persisted state를 Home UI가 읽는다.
    const save = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      { method: "POST", body: "{}" }
    );
    expect(save.status).toBe(200);
    expect((await save.json()) as unknown).toEqual({ saved: true });

    const { container, queryClient } = renderSavedIdeasAs(harness, VIEWER.id);

    // 실제 read-through 결과가 카드로 나타난다(로딩 → 데이터).
    const heading = await screen.findByRole("heading", {
      name: "오사카 벚꽃 여행",
      level: 3,
    });
    expect(heading).toBeInTheDocument();

    // detail link는 public listingId만 쓴다.
    const link = heading.closest("a");
    expect(link?.getAttribute("href")).toBe(`/explore/${listingId}`);

    // privacy: 렌더된 DOM에 어떤 private reference도 없어야 한다.
    const html = container.innerHTML;
    expect(html).not.toContain(tripId);
    expect(html).not.toContain(planId);
    expect(html).not.toContain(AUTHOR.id);
    expect(html).not.toContain(VIEWER.id);

    // 실제 unsave route를 호출한 뒤 mounted Home query를 invalidate/refetch하면
    // persisted truth에 따라 카드가 사라지고 정직한 empty 상태가 나타난다.
    const unsave = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      { method: "DELETE", body: "{}" }
    );
    expect(unsave.status).toBe(200);
    expect((await unsave.json()) as unknown).toEqual({ saved: false });

    await act(async () => {
      await queryClient.invalidateQueries();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/아직 저장한 여행 아이디어가 없어요/)
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { name: "오사카 벚꽃 여행", level: 3 })
    ).not.toBeInTheDocument();
  });

  it("저장한 적 없는 세션에는 카드 없이 정직한 empty 상태만 보여준다(actor 격리)", async () => {
    const tripId = "trip-y";
    const planId = "plan-y";
    const listingId = "listing-y";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({
              planId,
              authorId: AUTHOR.id,
              authorName: AUTHOR.name,
            }),
          ],
        }),
      ],
      exploreListings: [
        listedListing({
          listingId,
          sourceTripId: tripId,
          sourcePlanId: planId,
          sourceAuthorParticipantId: AUTHOR.id,
          title: "교토 단풍 여행",
        }),
      ],
      // VIEWER만 저장했고 AUTHOR는 저장한 적 없다.
      exploreSaves: [
        { participantId: VIEWER.id, listingId, savedAt: "2026-08-26T00:00:00.000Z" },
      ],
    });

    // AUTHOR 세션으로 렌더: 저장 항목이 없으므로 empty 안내만.
    renderSavedIdeasAs(harness, AUTHOR.id);

    await waitFor(() => {
      expect(
        screen.getByText(/아직 저장한 여행 아이디어가 없어요/)
      ).toBeInTheDocument();
    });
    // 다른 세션(VIEWER)이 저장한 카드가 이 세션에 새지 않는다.
    expect(
      screen.queryByRole("heading", { name: "교토 단풍 여행", level: 3 })
    ).not.toBeInTheDocument();
  });
});
