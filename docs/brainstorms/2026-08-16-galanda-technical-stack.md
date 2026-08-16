---
date: 2026-08-16
topic: galanda-technical-stack
status: confirmed
source: ./2026-08-14-galanda-group-trip-product-brainstorm.md
---

# 갈란다 기술 스택 결정

## 1. 문서 목적

이 문서는 앱인토스 WebView 미니앱 `갈란다`의 MVP 기술 스택과 각 기술의 책임 경계를 기록한다. 제품 범위와 사용자 흐름은 [갈란다 그룹 여행 의사결정 제품 정의서](./2026-08-14-galanda-group-trip-product-brainstorm.md) 및 [화면 흐름 및 화면 명세](./2026-08-14-galanda-screen-flow-brainstorm.md)를 따른다. 구체적인 의존성 방향과 실행 구조는 [Effect-first 아키텍처 결정](./2026-08-16-galanda-effect-first-architecture-brainstorm.md), URL과 화면 이동 규칙은 [라우팅 아키텍처 결정](./2026-08-16-galanda-routing-architecture-brainstorm.md)에 기록한다.

## 2. 확정 기술 스택

| 영역 | 선택 | 버전 기준 | 역할 |
|---|---|---|---|
| 프론트엔드 | React, TypeScript, Vite | React 18, TypeScript 6, Vite 8 | WebView UI와 빌드 환경 |
| 디자인 시스템 | `@toss/tds-mobile`, `@toss/tds-mobile-ait` | 2.x | 앱인토스 UI와 사용자 경험 |
| 미니앱 프레임워크 | `@apps-in-toss/web-framework` | 3.x | 앱인토스 SDK, 빌드와 배포 |
| 클라이언트 라우팅 | `react-router-dom` | 7.x | URL, history, 중첩 레이아웃과 딥링크 화면 매핑 |
| 도메인 및 비동기 프로그램 | `effect` | `4.0.0-rc.109` 정확 버전 고정 | 검증, 오류, 재시도, 동시성, 서비스 구성 |
| React 서버 상태 | `@tanstack/react-query` | 5.x | 캐시, 요청 중복 제거, 재조회, mutation 상태 |
| 데이터베이스 및 BaaS | Supabase, `@supabase/supabase-js` | 클라이언트 2.x, PostgreSQL, RLS, Database Functions | 영속성, 권한, 관계형 조회와 원자적 변경 |
| 인증 경계 | 토스 로그인용 최소 파트너 서버 | mTLS 필수 | 토스 인가 코드 교환과 Supabase 사용자 연결 |

## 3. Effect 사용 원칙

Effect v4를 도메인과 비동기 처리의 기본 실행 모델로 사용한다. 도메인에서 공개하는 계산·검증 API, Use Case와 모든 데이터 접근 프로그램은 Effect로 표현하고 React presentation 경계에서 ViewModel로 변환한다.

- `Schema`: 폼 입력, 딥링크, 외부 API 등 신뢰 경계의 검증
- `Brand`: `TripId`, `OptionId`처럼 혼동하면 안 되는 식별자
- `Option`: 값의 부재 자체가 도메인 의미를 가질 때 사용
- `Data`: 구조화된 도메인 오류와 데이터 타입
- `Context.Service`: 외부 의존성이 있는 서비스의 계약과 주입
- `Layer`: 서비스 구현과 실행 환경 구성

v4에서는 v3의 `Context.Tag` 대신 `Context.Service`를 사용한다. RC 기간에는 `effect`와 추가하는 모든 `@effect/*` 패키지를 같은 RC 버전으로 정확히 고정한다. `package.json`의 Effect 버전과 읽기 전용 참조 소스인 `repos/effect`의 태그도 항상 일치시킨다.

`@effect/atom-react`는 현재 React 19.2.7 이상을 요구하고 TDS는 React 18을 사용하므로 도입하지 않는다. TDS가 React 19를 지원한 뒤에 TanStack Query를 대체할 수 있는지 다시 평가한다.

## 4. Effect와 TanStack Query의 책임 경계

Effect가 비동기 실행을 담당하더라도 TanStack Query는 유지한다. 두 도구가 같은 상태를 중복 관리하지 않도록 책임을 다음과 같이 나눈다.

- Effect: 도메인 연산, 데이터 접근 프로그램, 타입이 있는 오류, 재시도·타임아웃·취소, 서비스 의존성
- TanStack Query: query key 기반 React 캐시, 화면 생명주기, stale 상태, mutation과 invalidation
- React 컴포넌트: 로딩·오류·성공 상태를 렌더링하고 사용자 입력을 전달

TanStack Query의 `queryFn`과 `mutationFn`은 Effect 프로그램을 실행하는 얇은 경계로 둔다. query의 `AbortSignal`은 Effect Runtime에 전달한다. 재시도는 Effect가 담당하므로 TanStack Query의 자동 `retry`는 비활성화한다. query 결과는 `select` 또는 feature의 presentation adapter에서 ViewModel로 변환하며, React 컴포넌트는 Effect 도메인 타입을 직접 처리하지 않는다. 별도의 범용 비동기 훅이나 캐시 계층은 만들지 않는다.

## 5. Supabase 선택 근거

갈란다는 여행방, 참여자, 여행안, 임시안, 숙소·교통 구간, 구성원 의견, 확정 일정 사이의 관계와 권한 규칙이 핵심이다. Supabase의 PostgreSQL, RLS와 Database Functions가 이 구조에 더 적합하다고 판단했다.

- 관계형 조회와 여행안 비교·집계를 SQL로 표현할 수 있다.
- 방장, 참여자, 작성자 권한을 RLS 정책으로 데이터 접근 경계에 둘 수 있다.
- 여행안 공개, 의견 초기화, 최종 확정과 일정 생성처럼 여러 데이터를 함께 바꾸는 작업을 Database Function 한 번으로 원자적으로 처리할 수 있다.
- PostgreSQL을 사용하므로 Firestore보다 데이터와 쿼리의 이식성이 높다.

Firestore는 Firebase Custom Token, 실시간 구독과 오프라인 기능에서는 유리하다. 그러나 갈란다에서는 관계를 비정규화하고 집계 값을 중복 저장하며 Security Rules와 트랜잭션으로 일관성을 유지하는 코드가 늘어날 가능성이 크다. MVP의 실시간·오프라인 요구가 핵심이 아니므로 Supabase를 선택한다.

개발·데모 환경에서는 같은 도메인 Port를 구현하는 LocalStorage Layer를 제공한다. LocalStorage Layer는 시드 데이터와 가상 사용자 전환을 위한 단일 기기 저장소이며 실제 보안, 다중 사용자 동시성, Realtime 또는 사용자용 오프라인 동기화를 제공하지 않는다. 운영 환경의 권한과 원자성은 계속해서 Supabase RLS와 Database Functions가 보장한다.

## 6. 인증 구조

토스 로그인은 클라이언트에서 완료하지 않는다.

1. WebView가 `appLogin`으로 인가 코드를 받는다.
2. 인가 코드를 최소 파트너 서버에 전달한다.
3. 파트너 서버가 mTLS로 토스 액세스 토큰과 사용자 정보를 조회한다.
4. 토스 사용자를 갈란다의 내부 사용자에 연결한다.
5. 클라이언트는 Supabase가 검증할 수 있는 짧은 수명의 JWT로 Data API와 RLS를 사용한다.

mTLS 인증서와 서명 키, Supabase 비밀 키는 클라이언트 번들에 포함하지 않는다. 인증 구현을 시작할 때 이 전체 흐름을 먼저 수직으로 검증한 뒤 다른 데이터 기능을 확장한다.

## 7. Realtime 범위

Supabase Realtime은 MVP의 기본 데이터 경로에 포함하지 않는다. 최초 구현은 mutation 성공 후 관련 query를 invalidate하고, 화면 재진입이나 포커스 복귀 시 필요한 데이터를 다시 조회한다.

사용자 테스트에서 같은 여행방의 의견과 여행안 변경을 즉시 반영해야 할 필요가 확인되면 Realtime을 추가한다. 이때 Realtime 이벤트는 별도 상태를 만들지 않고 TanStack Query 캐시를 갱신하거나 invalidate하는 신호로만 사용한다.

## 8. 현재 적용 상태

현재 저장소에는 React 18, TypeScript, Vite, TDS, 앱인토스 Web Framework와 Effect v3가 설치되어 있다. 이 문서의 결정 중 다음 항목은 아직 코드에 적용되지 않았다.

- Effect `4.0.0-rc.109` 전환과 `repos/effect` 동기화
- TypeScript strict 모드 활성화
- TanStack Query v5 도입
- Supabase 프로젝트, 스키마, RLS와 Database Functions 구성
- 토스 로그인용 mTLS 파트너 서버와 Supabase JWT 연결

이 문서는 기술 선택의 확정 기록이며, 설치·마이그레이션·데이터 모델 구현은 별도 구현 계획에서 다룬다.

## 9. 참고 자료

- [앱인토스 WebView 시작하기](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview)
- [라우팅 아키텍처 결정](./2026-08-16-galanda-routing-architecture-brainstorm.md)
- [React Router 문서](https://reactrouter.com/)
- [Effect v4 저장소](https://github.com/Effect-TS/effect)
- [Effect Atom React 의존성](https://github.com/Effect-TS/effect/blob/main/packages/atom/react/package.json)
- [TanStack Query 문서](https://tanstack.com/query/latest/docs/framework/react)
- [앱인토스 Supabase 연동](https://developers-apps-in-toss.toss.im/ai-vibe-coding/integration/supabase.html)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [토스 로그인](https://developers-apps-in-toss.toss.im/documentation/common/authentication/toss-login)
