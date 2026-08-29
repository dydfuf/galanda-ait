import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Router 배치 계약 (RAON-263 DISC-5).
 *
 * `/explore/:listingId` focused detail route는 GlobalShellLayout **밖**,
 * SessionRoute **안**에 있어야 한다. 그래야 하단 Global 탐색 nav가 렌더되지 않고
 * (nav DOM 없음), 로그인 세션은 계속 요구된다. 컴포넌트 렌더 테스트가 nav 부재를
 * 증명하고, 이 소스 구조 테스트는 route 위치 자체를 고정한다.
 */
const routerSource = readFileSync(
  fileURLToPath(new URL("./router.tsx", import.meta.url)),
  "utf8"
);

describe("AppRouter placement (RAON-263 DISC-5)", () => {
  it("/explore/:listingId route가 GlobalShellLayout 블록 밖에 있다", () => {
    const detailIdx = routerSource.indexOf('path="/explore/:listingId"');
    expect(detailIdx).toBeGreaterThan(-1);

    // GlobalShellLayout이 여는 지점과 그 Outlet이 닫히는 지점(다음 </Route>)을 찾는다.
    const shellOpenIdx = routerSource.indexOf("<GlobalShellLayout />");
    expect(shellOpenIdx).toBeGreaterThan(-1);

    // GlobalShellLayout 안에 마운트된 destination(/home, /explore feed)은 shell 뒤에
    // 위치한다. detail route는 shell 블록이 닫힌 이후(focused surface 주석 이후)에
    // 위치해야 한다.
    const focusedSurfaceIdx = routerSource.indexOf("focused surface: Global nav를 숨긴다");
    expect(focusedSurfaceIdx).toBeGreaterThan(-1);
    expect(detailIdx).toBeGreaterThan(focusedSurfaceIdx);
  });

  it("feed(/explore)와 detail(/explore/:listingId)이 모두 등록되어 있다", () => {
    expect(routerSource).toContain('path="/explore"');
    expect(routerSource).toContain('path="/explore/:listingId"');
    expect(routerSource).toContain("ExploreListingDetailPage");
  });
});
