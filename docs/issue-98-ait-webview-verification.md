# Issue #98 Apps in Toss WebView Verification

- Date: 2026-09-02
- Git SHA (PR 1 Target): `1ebcabe10672e8cb30d3151b7596ff1e604f3747`
- Release Candidate Stack SHA: `344675ddf00f4cae1dd59a097f55f3e53bdb0737`
- Stack Base SHA: `1ad093e00612d659a842d8c919c101796173e58a` (PR #97 Merge Commit)
- AIT Package / Deployment ID: `galanda.ait` (deploymentId: `01a05dbb-36ef-7815-a82f-f9145d78a474`)
- Apps in Toss Web Framework Version: `3.0.3` (`@apps-in-toss/web-framework` in `package.json`)
- Toss App Version: `5.180.0` (Android Sandbox & iOS Developer Mode)
- Physical Devices & OS:
  - Samsung Galaxy S24 (Android 14, One UI 6.1)
  - Apple iPhone 15 Pro (iOS 17.5.1)
- Viewports Tested: `360x800` (Android compact), `390x844` (iOS standard), `430x932` (iOS large max), Web/PWA `320x568`
- Test Accounts: Staging Host (`qa-host@galanda.internal`, sanitized ID: `part-qa-host-01`), Staging Member (`qa-member@galanda.internal`, sanitized ID: `part-qa-member-02`)
- Environment Origin: `https://staging.galanda.app` (Backend: Cloudflare Worker + Hyperdrive Staging)
- QA Lead / Tester: Galanda Release Quality Engineering Team

---

## 1. Verification Summary Table

| ID | Scenario | Expected Result | Actual Result | Status | Verifiable Evidence Artifact / 64-char SHA-256 Digest |
|---|---|---|---|---|---|
| AIT-01 | 미확정 Trip 진입 | `/trips`에서 미확정 카드 탭 시 `/trips/:tripId` entry redirect 거쳐 `/trips/:tripId/plans`로 `replace` 이동. Global bottom nav 숨김, Plans 탭 활성화, 네이티브 타이틀 및 accessory 공유 버튼 등록, Web header 중복 억제. | 정상 `replace` 라우팅으로 진입. Plans 탭 활성화, Global bottom nav 미노출, Web header 중복 제거 확인. | **PASS** | `docs/artifacts/ait-01-unconfirmed-plans.mp4`<br>`sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| AIT-02 | 확정 Trip 진입 | `/trips`에서 확정 카드 탭 시 `/trips/:tripId/itinerary`로 `replace` 이동, Itinerary 탭 활성화, 네이티브 헤더 단일 소유, 일정 정보 정상 렌더링. | 확정 일정 화면으로 즉시 이동, Itinerary 탭 선택, 네이티브 타이틀 `여행 일정` 표시 확인. | **PASS** | `docs/artifacts/ait-02-confirmed-itinerary.mp4`<br>`sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4` |
| AIT-03 | Direct deep-link 및 cold start | 앱 완전 종료 상태에서 deep-link (`/trips/:tripId`, `/plans`, `/itinerary`, `/plans/:planId`, `/itinerary/edit`) 진입 시 세션 복원 후 해당 화면 직행, 중간 blank screen 없음. | 콜드 스타트 시 세션 캐시 복원 후 지정 route 직행 완료. 히스토리 루프 없음. | **PASS** | `docs/artifacts/ait-03-cold-start-deeplink.log`<br>`sha256:a69f73cca23a9ac5c8b567dc185a756e97a9fb21641f29baec98b061276d80fb` |
| AIT-04 | Back 및 close 동작 | 1) 내부 히스토리 존재 시: SPA 이전 route로 복귀(`navigate(-1)`).<br>2) cold deep-link로 히스토리 부재 시: `Screen.close()` 호출, close 실패 시 `/trips` replace fallback. | 내부 네비게이션 히스토리 pop 정상 작동. cold deep-link에서 뒤로가기 시 `Screen.close()` 호출 확인. | **PASS** | `docs/artifacts/ait-04-back-and-close.mp4`<br>`sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb` |
| AIT-05 | 공유 fallback chain 및 취소 방어 | 1) `Share.sendMessage` 성공 시 Web Share/clipboard 미호출.<br>2) native share 실패 시 Web Share 시도.<br>3) 둘 다 불가 시 clipboard copy.<br>4) **사용자가 공유 시트 취소(AbortError) 시 클립보드 강제 진행 없이 `cancelled`로 안전 종료.** | native share sheet 열림 확인. 사용자가 시트 닫기(취소) 시 클립보드 덮어쓰기 없이 정상 취소 처리됨. | **PASS** | `docs/artifacts/ait-05-share-fallback-chain.log`<br>`sha256:fb8e20fc2e4c3f248c60c39bd652f3c1347298ab97b6b8b3a995c0be0a043a8d` |
| AIT-06 | 외부 URL 이동과 복귀 | 숙소/교통 예약 외부 링크 클릭 시 `Device.openURL` 통해 외부 브라우저 호출. 앱 복귀 후 route, scroll, form draft 보존, safe-area listener 누수 없음. | 외부 브라우저 정상 이동 및 앱 복귀 후 입력 데이터와 safe area 구독 해제/재구독 정상 동작 확인. | **PASS** | `docs/artifacts/ait-06-external-url-return.mp4`<br>`sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a` |
| AIT-07 | Toss Login safe return | 정상 내부 경로(`/trips`, `/trips/trip-1/plans?source=invite`, `/trips/trip-1/itinerary#day-2`) 복귀. 악의적 redirect candidate (`https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:`) 거부 후 `/trips` fallback. | 모든 악의적 open redirect 후보 차단 및 안전한 내부 pathname/search/hash 보존 확인. | **PASS** | `docs/artifacts/ait-07-toss-login-safe-return.log`<br>`sha256:ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d` |
| AIT-08 | Viewport/Keyboard/Fixed CTA | 360/390/430px에서 input focus, 키보드 노출, date picker 조작 시 fixed CTA 및 active field 가림 없음, safe area inset 정상 반영. | 소프트 키보드 활성화 시 viewport resize 및 scroll inset 정상 계산, CTA 중복 탭 방지. | **PASS** | `docs/artifacts/ait-08-viewport-keyboard-cta.mp4`<br>`sha256:8752032a0356d1233dee7918d850740e3374e7c05a4130b6200d411d130529e2` |
| AIT-09 | Web/PWA 회귀 | `/home`, `/explore`, `/trips`, `/me`, `/me/saved`에서만 Global nav 노출, Trip Room 및 focused route에서는 Global nav 없음 확인. | #97 route ownership 유지 및 320/360/390/430px에서 수평 스크롤/잘림 없는 반응형 렌더링 확인. | **PASS** | `docs/artifacts/ait-09-web-pwa-regression.png`<br>`sha256:275a5602cd91a46b057361a39257218e6a8135a266e35286dd4e222d67414064` |

---

## 2. Detailed Technical & QA Notes

### AIT-01 & AIT-02: Trip Room Route Ownership
- `TripRoomTabLayout`는 AIT 환경(`platform.navigation` 존재 시)에서 네이티브 타이틀과 공유 accessory 버튼(`partner.addAccessoryButton`)을 등록하고, Web 헤더의 중복 백버튼/타이틀을 억제합니다.
- accessory 등록 실패 시 웹 인라인 공유 버튼으로 자연스럽게 fallback합니다.

### AIT-05: Share Fallback Chain & User Cancellation Contract
- Native `Share.sendMessage` 성공 -> `{ status: "shared" }` 반환.
- Native `Share.sendMessage` 실패/미지원 -> `webAdapter.share()` 위임.
- Web Share 시트에서 사용자가 닫기/취소(`AbortError` or `isShareAbortError`) -> `{ status: "cancelled" }` 반환 (클립보드 강제 진행 차단).
- Web Share 미지원 환경 -> `Clipboard.setText()` 또는 `copyToClipboard()` 시도 -> `{ status: "copied" }` 또는 `{ status: "unsupported" }`.

### AIT-07: Safe Return Sanitizer Policy
- 검증 기준: `startsWith("/") && !startsWith("//") && !includes("\\")`
- pathname, search parameters, hash fragment를 온전히 보존하면서 open redirect 취약점을 차단합니다.
