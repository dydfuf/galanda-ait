# Galanda spot illustrations

`GalandaSpot`이 기존 이름과 경로로 렌더링하는 장식용 SVG입니다. 기능 아이콘(16–24px)과 별개이며 화면의 제목·설명·버튼이 의미를 소유합니다.

## 홈·빈 상태 묶음

| 이름 | 사용처 | 표현 |
| --- | --- | --- |
| `empty-trips` | 여행이 없는 홈과 기존 여행 목록 빈 상태 | 첫 여행을 기다리는 가방과 작은 경로 지도 |
| `create-trip` | 지난 여행만 있는 홈 및 기존 여행 생성 안내 | 새 경로를 시작하는 지도와 더하기 |
| `empty-saved` | 저장 목록의 실제 빈 상태 | 후보를 기다리는 보관 카드와 북마크 |

세 그림은 같은 좌상단 광원, 둥근 모서리, 절제된 면 명암으로 입체감을 표현합니다. 바닥 그림자·후광·배경 판·필터·래스터 이미지는 없습니다. 제목이나 행동 버튼을 그림 안에 넣지 않습니다. 그림의 더하기/북마크는 별도 컨트롤이나 저장·확정 성공 상태가 아닙니다.

## 규격·테마

원본은 240×240 좌표계이며 화면 표시는 기존 128×128입니다. `GalandaSpot`은 이미지 속성과 컨테이너 크기를 미리 확보하고, 이미지가 없어도 텍스트와 행동은 그대로 남깁니다. Vite `BASE_URL`과 `.dark` 테마 전환을 유지합니다.

라이트·다크 파일은 **동일한 도형과 그라데이션 좌표**에 서로 다른 팔레트만 사용합니다. 이 세 묶음은 원본에서 다크 대비를 조정했으므로 `brightness-125`를 중복 적용하지 않습니다. 이번에 바꾸지 않은 `invite-companions`, `compare-plans`, `confirm-plan`에는 기존 보정과 SVG를 유지합니다. SVG의 `url(#...)`는 같은 파일 안 그라데이션만 참조합니다. 인라인으로 붙이지 않고 기존 외부 이미지로 사용합니다.

## 적용·검증

새 상태나 CTA를 만들지 않고 기존 이름의 SVG 쌍을 교체합니다. 홈의 `여행 탐색`만 공통 `GalandaIcon`으로 맞추며, 이동 경로·조회 조건·캐시 유지·재시도·페이지네이션·확정/예약 의미는 바꾸지 않습니다. `PageState`의 로딩/오류 분기에 빈 상태 그림을 추가하지 않습니다.

```bash
pnpm exec vitest run src/components/galanda/galanda-spot.test.tsx src/features/home/home-empty-state-spots.test.tsx src/features/home/HomePage.test.tsx src/features/me/SavedListingsPage.test.tsx
pnpm check
```

추가 검사: 테마 쌍의 도형 일치, 외부 참조/동작/필터 없는 정적 SVG, 파일당 4KB 미만, 128px 자리 확보, 장식 접근성, 비루트 asset base, 홈/저장 목록의 상태 분리. 기존 `/dev#assets`에서 6종을 검토할 수 있습니다. 실제 확인한 브라우저·뷰포트·테마·검증 제한은 PR에 따로 기록합니다.
