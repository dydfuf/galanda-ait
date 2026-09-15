# 공동 여행 자료함

여행방의 `자료함`(`/trips/:tripId/resources`)에서 멤버가 링크와 메모를 함께
저장하고, `정보 정리`로 장소별 카드를 만든다. 숙소·맛집·관광·액티비티·기타로
분류하며 장소명, 위치, 설명, 원문 인용, 정리 시각을 보여준다.

## 제품 계약

- 링크 또는 메모 하나만 있어도 저장한다. 원본은 정리 실패와 관계없이 유지한다.
- 여행 멤버만 조회·추가·정리·카드 수정이 가능하다. 원본과 연결 카드의 삭제는
  작성자 또는 방장만 가능하다. client의 작성자·권한 입력은 받지 않는다.
- 카드 수정은 원문 인용을 보존하고 `멤버가 수정함`으로 구분한다.
- `places: null`은 미정리, `[]`는 정리는 성공했지만 특정 장소를 찾지 못한 상태다.
  처리 실패를 장소 없음으로 저장하지 않는다. 완료된 자료를 재정리하지 않는다.
- 링크를 읽지 못했으나 메모가 있으면 메모에서만 추출하고 이 사실을 표시한다.
  읽을 내용이 없으면 오류를 보여준다. URL만 보고 장소를 추측하지 않는다.
- HTTP 200이어도 로그인·봇 차단·내비게이션만 있는 페이지는 읽은 원문으로
  취급하지 않는다. 모델의 `linkUsable` 판정이 false이면 메모의 근거만 허용하고
  `UNAVAILABLE`로 기록한다. 메모도 없으면 `SOURCE_UNREADABLE`로 실패해
  `places: null`과 재시도 가능 상태를 유지한다.
- 카드의 장소명·위치와 근거 인용은 동일한 원문 구절에서 확인한다. 설명은 AI의
  요약이므로 사실 검증을 대신하지 않는다. 가격·운영 정보는 원문에서 재확인한다.
- 첫 버전은 원본 하나씩 저장하고 장소별 카드를 제공한다. 원본 편집, 자료 간
  동일 장소 병합, 후보 추천, 지도, 여행안·일정 자동 반영은 포함하지 않는다.
- 한 여행에 자료 200개, 메모 20,000자, 자료 하나당 장소 20개까지 지원한다.
  여러 자료의 전체 일괄 분석이나 20개를 초과하는 장소 추출은 제공하지 않는다.

## 저장과 동시 수정

`trip_resources`는 여행안과 별도 테이블이다. 자료 생성 시 부모 여행 row를 잠가
개수 확인과 insert를 한 transaction에서 처리한다. 카드 수정·삭제에는 자료별
`expectedRevision` CAS를 적용한다. 충돌하면 입력을 보존하고 최신 내용을 확인한
뒤 사용자가 명시적으로 재시도한다. 여행안의 revision은 변경하지 않는다.
삭제 충돌은 확인창 안에서 최신 원본·카드를 불러온 뒤 새 revision으로 다시
삭제할 수 있다. 재조회 실패·이미 삭제됨·권한 상실 상태에서는 삭제를 차단한다.

읽기는 세션별 query cache를 사용한다. 원문·근거가 포함된 전체 목록을 주기적으로
가져오지 않고 화면 진입·복귀, 네트워크 재연결, 자료 변경, 수동 새로고침 때 갱신한다.
큰 여행의 최초 응답 크기는 여전히 자료 수에 비례한다. 필요해지면 목록 요약과
상세 조회를 분리한다.
AI 요청이 끝난 뒤 membership을 다시 확인하고 CAS로 결과를 저장하므로,
처리 중 탈퇴·삭제·동시 수정이 생겨도 이전 데이터를 다시 쓰지 않는다.

## 링크 읽기

Workers `fetch`와 `HTMLRewriter`로 공개 HTML 또는 plain text를 읽는다.
쿠키·인증 헤더를 전달하지 않고 script/style/navigation을 제거한다. HTML 문자는
이미 lockfile에 있던 `entities` 8.0.0을 직접 의존성으로 선언해 해석한다.

초기 읽기 허용 범위는 다음 provider 소유 host이다. 정확한 목록은
`worker/infrastructure/ai/trip-resource-extractor.ts`의 `SOURCE_HOSTS`와
`readableResourceUrl`이 기준이다.

- 네이버 블로그·포스트, `*.tistory.com`, 브런치
- Booking.com, Agoda, Airbnb, Tripadvisor, Klook, 마이리얼트립의 명시된 host

임의 host·IP·포트·자격증명 포함 URL을 가져오지 않는다. redirect 목적지도 같은
기준으로 매번 검증하고 최대 3회만 따른다. 그 밖의 링크도 원본으로 저장할 수
있으며, 정리하려면 읽을 본문을 메모로 새로 저장한다. 위 사이트도 로그인·봇 차단·
JavaScript 렌더링 때문에 읽기에 실패할 수 있다. PDF·영상·이미지 분석은 없다.

페이지 읽기는 8초·500KB·추출 텍스트 50,000자, 전체 AI 처리 30초,
provider 응답 150KB로 제한한다. 큰 본문은 실패 처리하며 원본을 보존한다.

## AI 활성화와 배포

기존 Cloudflare AI Gateway + OpenAI Responses 경계를 재사용한다.
새 서비스나 Vector DB, background job은 없다.

환경별 필요한 설정:

```text
AI_RESOURCE_MODEL=<사용할 OpenAI 모델 ID>
AI_GATEWAY_ACCOUNT_ID=<계정 ID>
AI_GATEWAY_ID=<Gateway ID>
AI_GATEWAY_TOKEN=<Worker secret>
```

BYOK를 쓰는 환경만 `OPENAI_API_KEY` secret도 필요하다. Gateway 저장 키 또는
Unified Billing을 사용하는 환경은 기존 Gateway 설정을 유지한다. 이 기능은
`AI_RECOMMENDATION_MODE`와 독립적이다. 설정이 없으면 API가
`extractionAvailable: false`를 반환하며 원본 저장은 계속 가능하다.

모델로 전달하는 내용은 사용자가 선택한 자료 하나의 읽은 본문과 메모다.
원본 페이지 내용은 명령으로 취급하지 않으며 외부 도구 호출을 허용하지 않는다.
`store: false`, `cf-aig-collect-log-payload: false`, provider 재시도 1회로
본문·응답 보관과 자동 재시도를 끈다. 활성화 환경에는 Gateway 요청·비용 제한을
설정한다. 동시에 같은 자료를 정리하면 provider 요청이 중복될 수 있지만
CAS를 통과한 결과 하나만 저장된다.

배포 순서:

1. [Staging runbook](staging-operations-runbook.md)에 따라 migration 전용 계정으로
   `0013_trip_resources` migration을 적용한다. Worker runtime 권한은 새 테이블의
   기존 방식 DML만 허용한다.
2. 환경별 AI 설정과 Gateway 제한을 확인하고 Worker/Web을 배포한다.
3. 인증한 여행 멤버 두 명으로 원본 저장·공동 조회·정리·카드 수정·충돌·삭제를
   확인한다. 실제 모델 응답, 설치형 PWA, AIT 실기기 검증은 로컬 자동 테스트와 구분한다.

관련 테스트는 `trip-resources.test.ts`, `trip-resource-repository.test.ts`,
`trip-resource-extractor.test.ts`, `TripResourcesPage.test.tsx`, `queries.test.tsx`에 있다.
