# Issue #98 Apps in Toss WebView Verification

- Date: 2026-09-02
- PR #99 current head SHA: `4bf478798173d648286d222bb4c418cd92f08c5f`
- PR #101 current head SHA: `317807a6e55da216ac34669121a79f9187e26950`
- PR #102 current stack tip SHA: `d72e618250075f07ec5611519217b877e5b2b074`
- Stack base SHA: `1ad093e00612d659a842d8c919c101796173e58a` (PR #97 merge commit)
- AIT package / deployment metadata: **NOT VERIFIED**
- Test accounts and environment origin: **NOT VERIFIED**

> Evidence gate: this checkout and the current PR metadata contain no downloadable WebView videos, logs, or Actions artifacts for the scenarios below. Previous PASS claims and digests are intentionally not carried forward because they cannot be recalculated from an accessible payload. A scenario may become PASS only after its artifact is attached and its SHA-256 is calculated from that downloaded file.

## Verification Summary

| ID | Scenario | Expected Result | Actual Result | Status | Evidence / SHA-256 |
|---|---|---|---|---|---|
| AIT-01 | 미확정 Trip 진입 | `/trips` → `/trips/:tripId` entry → `/trips/:tripId/plans`; AIT native header/accessory ownership and Web fallback are correct. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-02 | 확정 Trip 진입 | `/trips` → `/trips/:tripId/itinerary`; Itinerary tab and native header ownership are correct. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-03 | Direct deep-link / cold start | Session restore reaches the requested plan/itinerary route without a blank screen or redirect loop. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-04 | Back / close | Existing SPA history pops; cold deep-link calls `Screen.close()` with `/trips` fallback on failure. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-05 | Share fallback / cancel | Native → Web Share → clipboard fallback works, while `AbortError` returns `cancelled` without forced clipboard. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-06 | External URL return | `Device.openURL` navigation returns with route, scroll, draft, and safe-area state intact. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-07 | Toss Login safe return | Internal pathname/search/hash survives; external, protocol-relative, backslash, and `javascript:` candidates fall back safely. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-08 | Viewport / keyboard / fixed CTA | 360/390/430px input, keyboard, date picker, fixed CTA, and safe-area behavior are verified on device. | 실행 evidence 없음 | **BLOCKED** | 없음 |
| AIT-09 | Web/PWA regression | Global navigation appears only on global routes; Trip Room/focused routes remain free of it and render without clipping. | 실행 evidence 없음 | **BLOCKED** | 없음 |

## Implementation Contracts to Verify

- `TripRoomTabLayout` owns AIT native title and share accessory; Web renders its own header only when native navigation is absent.
- Share cancellation must stop the fallback chain and return `cancelled`.
- Safe return accepts only internal paths that start with `/`, do not start with `//`, and contain no backslash.

## Evidence follow-up

Attach each video/log to the PR or GitHub Actions artifact, download it, run `sha256sum <file>`, and record the resulting 64-character digest plus the deployment metadata and exact stack tip above. Until then, keep the status **BLOCKED**.
