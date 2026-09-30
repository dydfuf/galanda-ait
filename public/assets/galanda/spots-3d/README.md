# 갈라고 Blender 3D 일러스트

실제 Blender mesh·curve 모델을 직교 카메라와 공통 조명으로 렌더링한 8종의 장식용 이미지입니다. 이미지 생성 AI나 외부 모델·텍스처를 사용하지 않습니다.

| 이름 | 현재 사용처 | 표현 / 의미 |
| --- | --- | --- |
| `empty-trips` | 홈·여행 목록의 조회 성공 후 빈 상태 | 첫 여행을 기다리는 여행가방 |
| `create-trip` | 지난 여행만 있는 홈·첫 여행안 작성 안내 | 새 경로를 시작하는 지도 |
| `empty-saved` | 저장 목록의 실제 빈 상태 | 여행 후보를 담는 북마크 카드 |
| `invite-companions` | 권한이 있는 동행자 설정 단계 | 함께할 동행자 초대 안내 |
| `compare-plans` | 일정의 `UNCONFIRMED` 안내 | 동등한 두 후보, 선정·확정 성공 아님 |
| `confirm-plan` | `CONFIRMED` 응답의 일정 항목 없음 안내 | 여행안 확정, 숙소·교통 예약 완료 아님 |
| `empty-explore` | 적용된 필터 없는 탐색 빈 결과 | 새로운 여행을 찾는 나침반 |
| `empty-search` | 적용된 필터가 있는 탐색 빈 결과 | 조건에 맞는 일정 찾기 |

## 배포 계약

- `GalandaSpot`의 기존 이름·`data-spot`·128×128 자리 확보를 유지합니다
- 원본은 768×768 RGBA PNG, 배포본은 384×384 alpha WebP입니다. 128px 표시에서 3배 밀도를 제공합니다
- 라이트·다크에서 동일한 WebP 한 개만 표시합니다. 배경·후광·바닥 그림자·CSS 밝기 필터가 없으며 화면의 배경색이 그대로 드러납니다
- 그림은 빈 `alt`, 감싼 요소는 `aria-hidden`으로 장식 처리합니다. 제목·설명·기존 행동이 의미를 소유합니다
- 로딩·오류·오래된 데이터 경고·재시도·검색 조건·페이지네이션·권한·확정 여부는 기존 화면 분기를 그대로 따릅니다. 기능 아이콘이나 내비게이션을 대체하지 않습니다
- Vite `BASE_URL`을 따르며 Web/PWA는 WebP precache로 오프라인 접근을 유지합니다. AIT도 같은 정적 이미지 경로를 사용합니다
- 파일당 80KB, 전체 400KB 이하 예산을 테스트합니다. 원본 모델·고해상도 PNG는 앱 번들에 넣지 않습니다

## 편집과 검토

[원본 생성 안내](../../../../design/travel-assets/README.md)의 Blender Python과 후처리 명령으로 `.blend`, PNG, WebP를 재생성할 수 있습니다. 완성된 개별 `.blend`·PNG·WebP는 별도 전달되는 원본 묶음에도 포함됩니다. 이전 SVG는 `design/travel-assets/legacy-svg/`에 보존합니다.

개발 서버 `/dev#assets`에서 실제 `GalandaSpot`을 128px로 검토합니다. 같은 카탈로그의 테마 토글로 라이트·다크를 전환하고, `/dev#feedback`에서 텍스트·행동이 있는 빈 상태를 확인합니다.

```bash
pnpm exec vitest run src/components/galanda/galanda-spot.test.tsx src/features/home/home-empty-state-spots.test.tsx src/features/home/HomePage.test.tsx src/features/me/SavedListingsPage.test.tsx src/features/trip-list/TripListPage.test.tsx src/features/trip-setup/TripCompanionSetupPage.test.tsx src/features/itinerary/ItineraryPage.test.tsx src/features/itinerary/ItineraryPage.spots.test.tsx src/features/explore/ExplorePage.test.tsx src/features/explore/ExplorePage.spots.test.tsx
pnpm check
```

모델·alpha·크롭 검사와 직접 브라우저 확인 결과는 `design/travel-assets/VALIDATION.md`에 기록합니다. 카탈로그 화면과 상태별 component test는 실제 인증 서버·설치형 PWA·AIT 실기기 검증을 대신하지 않습니다.
