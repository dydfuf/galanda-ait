---
status: ready
priority: p1
issue_id: "001"
tags: [ui, acceptance]
dependencies: []
---

# UI/UX Closure #125

## Problem Statement

구조 구현과 실제 사용자 흐름의 검증을 구분하고 #126~#131의 완료 증거를 연결한다.

## Findings

- 기준 main: `4fa9331870f5f43a93274bfabba16c4f66efaffc`.
- 시작 시 staging 로그인 설정 404. 최신 main의 1,466개 테스트와 전체 gate 통과 후 배포했다.
- DEV route를 숨겨도 최상위 `lazy` 호출이 카탈로그 청크를 production에 남긴다. #126에서 수정 중.

## Proposed Solutions

기존 DEV 카탈로그·실제 staging UI·Vitest를 재사용한다. 별도 QA 앱/E2E runner는 사용자 결정으로 제외한다.

## Recommended Action

#126의 최소 재현 기준선 → #127 생성 → #128 협업 → #129 전역 UI, #130 공통 QA → #131 회귀·증거 대응표 순으로 진행한다.

## Acceptance Criteria

- [ ] #126 Review Pack, 독립 actor, seed/reset, 캡처, DEV 제외, PR
- [ ] #127 생성·중단·재개·검토·등록·복구
- [ ] #128 독립 세션 협업·freshness·권한·충돌
- [ ] #129 전역 화면·탐색·저장·가져오기·계정
- [ ] #130 모바일·접근성·실패·PWA, 기기 미검증 구분
- [ ] #131 최소 공통 계약·회귀, #123 대응표
- [ ] P0/P1 해결 및 동일 조건 재검증, PR/CI/이슈 결과 연결

## Work Log

### 2026-09-08

- 실제 하위 이슈 관계와 사용자 결정이 반영된 최신 #125/#126을 확인했다.
- baseline `pnpm check`: 146개 파일 / 1,466개 테스트, DB drift, Web/AIT build 통과.
- staging version `f3227555-5e25-4b8b-a028-4b29f0b7450b`, tag `4fa9331870` 배포 완료.
- `/api/auth/config` true 및 실제 로그인 후 `/api/session` REGISTERED 확인.
