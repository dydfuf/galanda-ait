# UX-05 공통 품질 — 현재 수정 및 중단 지점

**실기기 QA는 2026-09-09 사용자 결정으로 보류.** 이후 사용자 요청에 따라 현재 여백 수정까지만 마무리하고 추가 실행은 중단한다.

| 축 | 증거 수준/결과 |
| --- | --- |
| 320/360/390/430px 및 desktop | 기존 [evidence](../evidence.md)의 실제 Chrome viewport/DEV fixture. 대표 긴 문구·날짜·고정 CTA·dark·선택 카드 확인. 모든 화면×폭 조합 아님 |
| keyboard/overlay | 실제 브라우저에서 hidden native radio를 focus+Space로 조작, 마이 theme 변경/Escape 종료. 캡처에는 focus ring 포함. 전체 tab order/모든 overlay 복귀는 미완료 |
| 날짜/키보드/safe-area | DEV fixture 360×800, dark, `--safe-bottom:34px`, `--app-keyboard-inset:280px` 주입. 실제 OS 키보드/datepicker 검증 아님 |
| 저장/연결/권한/충돌 | UX-02/03/04 실제 실패→복구 기록 재사용. frontend UI만으로 서버 권한 통과를 주장하지 않음 |
| PWA | 실제 staging update toast→사용자 버튼→새 코드 적용. 설치형 PWA/offline cache·기기 키보드·screen reader 조합은 미검증/보류 |

## UXF-006 — 마지막 입력의 키보드/CTA 가림

기존 `PageBody withBottomAction`은 footer 높이만큼만 여백을 확보했다. 키보드에 의해 footer가 올라와도 끝까지 스크롤할 공간이 부족했다. 또한 `ResizeObserver.observe` 기본 content-box 관찰 때문에 safe-bottom padding 변화만 일어나면 측정값이 갱신되지 않았다.

- 수정 전: input top 338/bottom 394, footer top 372/bottom 520 → 하단 22px 겹침. footer 실측 148px인데 root 측정값은 114px, scrollY가 최대 320px에 도달.
- 수정: 본문 clearance에 keyboard inset 포함, footer 관찰은 border-box 지정. 기존 ResizeObserver와 CSS 변수만 사용한다.
- 동일 fixture 수정 후: input top 300/bottom 356, footer top 372/bottom 520 → **16px 간격**. 측정값 148px 일치, 가로 overflow 없음.
- [수정 전](../../../assets/ui-ux-closure/simulated-keyboard-360.png) / [수정 후](../../../assets/ui-ux-closure/simulated-keyboard-fixed-360.png).
- 기존 contract 검사 수정 전 3개 실패, 수정 후 2개 파일/9개 테스트 통과. 실제 geometry 증거는 위 Chrome 측정이며 jsdom을 geometry 증거로 사용하지 않는다.

재검증은 로컬 DEV fixture에서 완료했다. 이 수정의 실제 staging/실기기 화면 완료와 구분한다. #130 전체 matrix는 open 유지한다.

`VITEST_MAX_WORKERS=2 pnpm check`: 147개 파일/1,477개 테스트, lint/DB drift/typecheck/Web/AIT build exit 0. 테스트·timeout·CI 변경 없이 동시 실행 수만 제한했다.
