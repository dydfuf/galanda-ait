# 3D 여행 에셋 검증

2026-09-30 UTC. 기준 main: `a0d0bb0d9a8585951e80a7724c43d7a74b1b6bda`.
별도 `feat/minimal-3d-travel-assets` 변경이며 AI 추천 검증 PR #152와 독립적입니다.

## 모델·렌더

- Blender 4.3.2 / Cycles CPU / 512 samples / 768×768 RGBA
- 저장된 개별 `.blend` 8개를 별도 프로세스에서 다시 열어 검증: 모두 PASS
- 실제 mesh 78개, 편집 가능한 curve 10개. 외부 image texture/library 없음
- 공통 직교 카메라 방향, area light 3개, 투명 film, 상대 렌더 경로 확인
- 새 출력 폴더의 생성 smoke test 및 이동한 `.blend`의 상대 경로 재렌더 PASS
- PNG 8개, static alpha WebP 24개(256/384/512px) 생성
- 384px 배포본 8개 합계 88,610바이트, 각각 8,686–14,902바이트
- 가장자리 2px 완전 투명, 중앙 정렬, 최대 축 약78.5% 점유율, 잘림 없음
- 배포 WebP 8개의 SHA-256이 생성 manifest와 정확히 일치
- 128px 및 256px 라이트·다크 contact sheet 직접 픽셀 검토: 형태·구분·투명 가장자리 확인
- 사용자에게 실제 초기 3종 라이트·다크 미리보기를 보여준 뒤 같은 스타일로 제작 완료

자세한 증거: `asset-manifest.json`, `model-validation.json`, `qa-summary.json`.
원본 ZIP은 개별 .blend 8개/768px PNG 8개/WebP 24개/스크립트 3개 등을 포함하며
6,111,139바이트입니다. 모델·PNG·생성 도구는 public/dist에 배포하지 않습니다.

## 앱 연결·회귀

- `GalandaSpot` 8개 기존 이름/표시 조건을 유지하며 단일 WebP로 전환
- 128px 자리 확보, 빈 alt, aria-hidden, 비루트 Vite BASE_URL, 동일 파일의 테마 전환 검사 PASS
- 홈·여행 목록·저장 목록·초대·일정·탐색의 기존 로딩/오류/빈 상태/확정 분리 회귀 PASS
- 집중 검사: 10 files / 104 tests PASS. 공통 PageState의 이미지 개수 계약을 최종 단일 WebP에 맞춰 함께 갱신
- 최종 `pnpm check`: 166 files / 1,776 tests PASS, lint / DB schema·migration drift / types / Web build / AIT build 모두 exit 0
- 기존 저장소 lint warning은 유지. 첫 aggregate run에서 남아 있던 SVG 2개 전제 assertion 1개를 단일 이미지 계약으로 수정한 뒤 전체 gate를 다시 통과
- Web 빌드를 별도로 확인하여 생성된 `dist/sw.js`에 8개 WebP 모두 precache 포함, 배포 파일과 원본 bytes 일치 확인
- 이전 SVG를 `design/travel-assets/legacy-svg/`로 이동. `dist`에 과거 SVG·.blend·design 원본/검토 파일 없음

## 검증 한계

- 클라우드 브라우저가 `http://127.0.0.1:5174/dev#assets`를 `ERR_BLOCKED_BY_CLIENT`로 차단해 실제 앱 화면 브라우저 QA와 화면 캡처는 완료하지 못했습니다. 우회 터널·외부 배포를 사용하지 않았습니다
- Blender GUI 파일 대화상자의 AT-SPI provider 제한으로 GUI 편집 화면 캡처는 완료하지 못했습니다. 저장 모델의 별도 재오픈/geometry/재렌더는 Blender background에서 실제 확인했습니다
- contact sheet는 실제 렌더 에셋 검토용이며 앱 화면 캡처가 아닙니다
- 실제 인증 앱, 설치형 PWA의 오프라인 작동, AIT 실기기는 이번 변경에서 검증하지 않았습니다. PWA precache 생성과 Web/AIT 빌드 통과를 실기기 검증으로 표현하지 않습니다
- merge·배포·유료 provider 호출 없음. Draft PR에서 CI 결과와 검토 후 별도 배포가 필요합니다
