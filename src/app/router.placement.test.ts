import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Router 배치 계약 (RAON-263 DISC-5 / Issue #96).
 *
 * GlobalShellLayout은 Global IA 5개 목적지(/home, /explore, /trips, /me, /me/saved)만
 * 감싸야 한다. Trip room 진입/홈 및 focused 화면은 GlobalShellLayout 밖에 위치해야
 * 하단 Global nav가 렌더되지 않는다.
 */
const routerSource = readFileSync(
  fileURLToPath(new URL("./router.tsx", import.meta.url)),
  "utf8",
);

describe("AppRouter placement (Issue #96 / RAON-263 DISC-5)", () => {
  const shellStartIdx = routerSource.indexOf(
    "<Route element={<GlobalShellLayout />}>",
  );
  const shellEndIdx = routerSource.indexOf("</Route>", shellStartIdx);
  const globalShellBlock = routerSource.slice(shellStartIdx, shellEndIdx);

  const sessionStartIdx = routerSource.indexOf(
    "<Route element={<SessionRoute />}>",
  );
  const notFoundIdx = routerSource.indexOf('path="*"');
  const sessionEndIdx = routerSource.lastIndexOf("</Route>", notFoundIdx);
  const sessionBlock = routerSource.slice(sessionStartIdx, sessionEndIdx);

  it("GlobalShellLayout 블록 안에 5개 전역 목적지만 정확히 포함된다", () => {
    expect(shellStartIdx).toBeGreaterThan(-1);
    expect(shellEndIdx).toBeGreaterThan(shellStartIdx);

    expect(globalShellBlock).toContain('path="/home"');
    expect(globalShellBlock).toContain('path="/explore"');
    expect(globalShellBlock).toContain('path="/trips"');
    expect(globalShellBlock).toContain('path="/me"');
    expect(globalShellBlock).toContain('path="/me/saved"');

    // Trip room 및 focused 화면은 GlobalShellLayout에 없어야 한다.
    expect(globalShellBlock).not.toContain("TripRoomEntry");
    expect(globalShellBlock).not.toContain("TripRoomTabLayout");
    expect(globalShellBlock).not.toContain('path="/explore/:listingId"');
    expect(globalShellBlock).not.toContain('path="/trips/new"');
    expect(globalShellBlock).not.toContain("TripRoomChildLayout");
  });

  it("Trip Room entry, tab layout, child routes는 Global shell 밖, SessionRoute 안에 있다", () => {
    expect(sessionBlock).toContain("TripRoomEntry");
    expect(sessionBlock).toContain("TripRoomTabLayout");
    expect(sessionBlock).toContain("TripRoomChildLayout");
    expect(sessionBlock).toContain('path="/explore/:listingId"');

    // shell 블록 이후에 TripRoom / focused 화면들이 위치한다.
    const tripEntryIdx = routerSource.indexOf(
      "TripRoomEntry",
      sessionStartIdx,
    );
    const tripTabIdx = routerSource.indexOf(
      "TripRoomTabLayout",
      sessionStartIdx,
    );
    expect(tripEntryIdx).toBeGreaterThan(shellEndIdx);
    expect(tripTabIdx).toBeGreaterThan(shellEndIdx);
  });

  it("새 여행 생성과 동행자 설정은 registered session guard 안에 있다", () => {
    const registeredStartIdx = routerSource.indexOf(
      "<Route element={<SessionRoute registered />}>",
    );
    expect(registeredStartIdx).toBeGreaterThan(-1);
    const registeredEndIdx = routerSource.indexOf("</Route>", registeredStartIdx);
    const registeredBlock = routerSource.slice(
      registeredStartIdx,
      registeredEndIdx,
    );

    expect(registeredBlock).toContain('path="/trips/new"');
    expect(registeredBlock).toContain('path="/trips/:tripId/setup/companions"');
  });

  it("standalone 화면(로그인, 초대, 플랫폼 전용, 404)은 Global shell 및 SessionRoute 밖에 있다", () => {
    const loginIdx = routerSource.indexOf('path="/login"');
    const inviteIdx = routerSource.indexOf('path="/invites/:inviteToken"');
    const platformIdx = routerSource.indexOf("platformOnlyRoutes.map");

    expect(loginIdx).toBeLessThan(sessionStartIdx);
    expect(inviteIdx).toBeLessThan(sessionStartIdx);
    expect(platformIdx).toBeLessThan(sessionStartIdx);
    expect(notFoundIdx).toBeGreaterThan(sessionEndIdx);
  });
});
