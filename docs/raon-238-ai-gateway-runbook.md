# RAON-238 AI Gateway 운영 기준

## 현재 활성화 경계

RAON-238은 provider-neutral `TripActionRanker` port와 Cloudflare AI Gateway +
OpenRouter Chat Completions adapter를 제공한다. Recommendation route는
`AI_RECOMMENDATION_MODE=active`이고 승인된 policy version이 일치할 때만
adapter를 주입한다. First Plan 진행 단계처럼
deterministic primary가 있는 context는 active mode에서도 provider를 호출하지 않고,
등록된 plan 이후 복수 collaboration action이 있는 context만 AI ranking을 사용한다.
다만 RAON-239의 active rollout gate가 `NO-GO`인 동안에는 승인된 policy version이
없으므로 실제 사용자 응답은 계속 `RULE`이다.

## Worker 설정

활성화 작업에서는 다음 non-secret 설정을 환경별 Worker vars로 주입한다.

```text
AI_RECOMMENDATION_MODE=off|shadow|active
AI_RECOMMENDATION_MODEL=deepseek/deepseek-v4.1-flash
AI_RECOMMENDATION_POLICY_VERSION=v1
AI_RECOMMENDATION_ACTIVE_APPROVED_POLICY_VERSION=<approved policy version>
AI_RECOMMENDATION_TIMEOUT_MS=5000
AI_GATEWAY_ID=galanda-staging-ai
```

Worker에는 `ai: { "binding": "AI", "remote": true }`를 추가한다.
호출은 `env.AI.gateway(AI_GATEWAY_ID).run()`으로 보내며 provider는 `openrouter`,
endpoint는 `https://openrouter.ai/api/v1/chat/completions`다.
OpenRouter API 키는 Gateway의 Provider Keys(BYOK)에 저장한다. Worker에는
`AI_GATEWAY_TOKEN`, `OPENAI_API_KEY`나 OpenRouter 키가 필요하지 않다.

staging은 `shadow`, timeout 5초로 설정한다. 이 값은 관측용이며 active UX budget을
승인한 값이 아니다. 자료함은 별도 `AI_RESOURCE_MODEL`과 전체 30초 제한을 사용한다.
다음 행동 추천은 `reasoning: { "effort": "low" }`를 명시한다. 자료함의 추론 설정은
모델 기본값을 사용한다. `openrouter-v3`는 이 추론 설정과 전체 후보 순열을 요구하는 prompt/schema 계약을 포함한 요청 버전이다.

Model ID는 Worker vars로 관리한다. 실제 ranker policy와 cache identity는
`<policy>:openrouter-v3:<model>`이므로 모델이 바뀌면 캐시도 분리된다.
모델을 바꿀 때는 승인된 관측 구간도 분리하도록 `AI_RECOMMENDATION_POLICY_VERSION`을
함께 변경하고 active 승인을 다시 평가한다. `active`는
`AI_RECOMMENDATION_ACTIVE_APPROVED_POLICY_VERSION`이 현재 policy version과
일치할 때만 허용되며, 승인 값이 없거나 설정이 불완전하면 endpoint는 provider
error를 노출하지 않고 `RULE`로 동작한다. 승인 값은 RAON-239의 live eval과
모델/비용 검토가 끝난 뒤에만 주입한다.

## Active 안정성

- Context fingerprint는 trip ID, trip revision, actor role/capability scope, surface,
  draft completion, rule/model policy version, decision status와 eligible action/reason
  set을 포함한다.
- 응답의 `tripRevision`은 recommendation 계산 시점의 room revision이다. 클라이언트는
  현재 room revision과 비교해 stale recommendation을 적용하지 않는다.
- 동일 fingerprint의 검증된 ranking은 Workers Cache API에서 5분간 재사용한다.
- Trip revision 또는 policy version이 바뀌면 cache key도 바뀌므로 이전 ranking은
  현재 recommendation에 적용되지 않는다.
- Cache miss의 동시 요청은 각각 provider를 호출할 수 있다. 실제 중복 비용이
  관측될 때만 Durable Object 등 분산 suppression을 추가한다.
- Kill switch는 `AI_RECOMMENDATION_MODE=shadow|off` 전환이며 Worker vars로 active
  반영을 중단할 수 있다.

## Privacy와 비용 제어

- Adapter 입력은 surface, decision status, eligible action ID/reason code만 포함한다.
- 사용자 요청으로 `cf-aig-collect-log-payload: true`를 보내 Gateway에 요청·응답
  본문을 저장한다. provider/model/token/cost/status/duration metadata도 유지한다.
  변경 후 새 요청부터 적용되며 이전에 저장하지 않은 본문은 복구되지 않는다.
- Worker 바인딩이 Gateway 인증을 담당한다. Gateway의 provider 키를 클라이언트나
  Worker vars로 복사하지 않는다.
- Gateway rate limit과 OpenRouter key의 credit limit을 active 전환 전에 설정한다.
  OpenRouter `provider.data_collection: deny`, `require_parameters: true`로 데이터 수집과
  structured output 지원 조건을 제한한다. Gateway cache는 비활성화한다.
- Gateway retry는 `cf-aig-max-attempts: 1`, adapter wall-time은
  `AI_RECOMMENDATION_TIMEOUT_MS`로 제한한다. 외부 fetch 대기는 Worker CPU 시간이
  아니지만 사용자 응답 wall-time에는 포함된다.

## 관측과 장애 동작

Adapter는 payload 없이 provider, model, policy version, token 수, latency, HTTP status,
failure reason을 structured Worker log에 남긴다. Timeout, network/HTTP error, schema
failure, action 누락을 포함한 eligible-set 위반은 recommendation use case에서 즉시
deterministic `RULE` 결과로 fallback하며 provider retry chain은 실행하지 않는다.


### INVALID_OUTPUT 세부 진단

Public error는 기존 `TIMEOUT | PROVIDER_ERROR | INVALID_OUTPUT`을 유지한다.
Worker log/adapter telemetry와 eval case의 `diagnostics`에는 다음 bounded reason을
`invalidOutputReason`으로 추가한다. Eval summary의 `invalidOutputReasons`는 reason별
실패 횟수이며, 기존 `schemaFailureRate`는 모든 INVALID_OUTPUT을 포함하는 지표로 유지한다.

- `RESPONSE_READ`, `RESPONSE_TOO_LARGE`, `RESPONSE_JSON`: 본문 읽기, 150 KB 제한, envelope JSON 실패
- `ENVELOPE_SCHEMA`: choices/message 구조 오류 또는 choice 수가 1이 아님
- `FINISH_REASON`, `REFUSAL`, `EMPTY_CONTENT`: stop이 아닌 완료, refusal, 비어 있는 content
- `RANKING_JSON`, `RANKING_SCHEMA`: content의 JSON 또는 ranking schema 오류
- `EMPTY_CANDIDATES`, `UNKNOWN_ACTION`, `PRIMARY_REPEATED`, `DUPLICATE_ALTERNATIVE`,
  `MISSING_ACTION`, `REASON_MISMATCH`: 후보 집합/primary reason 계약 위반

검증은 위의 단계 순서로 진행한다. 예를 들어 finish_reason=length와 빈 content가 함께
오면 `FINISH_REASON`, finishReason=length, contentLength=0으로 기록한다.
JSON을 읽을 수 있으면 envelope가 거절되어도 유효한 usage token 수는 보존한다.
기존 optional/null usage 구조 검증은 유지하므로 잘못된 usage 형식은 계속 거절한다.
누락되거나 음수·소수·범위 밖인 token 수는 0이며, 이것이 비용이 0이라는 뜻은 아니다.

추가 metadata는 요청 계약을 구분하는 `requestVersion`, allowlist로 정규화한
`finishReason`, 숫자인 `choiceCount`와
`contentLength`, boolean인 `refusal`이다. 임의 finish reason은 `OTHER`로 기록한다.
원문, refusal 문구, JSON/schema 예외와 그 cause, 사용자 식별 정보는 추가하지 않는다.
Gateway 본문 저장 설정은 기존 정책을 유지한다.

요청은 모든 후보를 정확히 한 번 포함하고 primary를 alternatives에서 제외하며 primary와
짝인 reasonCode를 복사하도록 명시한다. Schema는 후보 enum과 property description에
이 계약과 정확한 alternatives 길이를
명시한다. 배열 길이·중복 및 cross-field reason 대응은 로컬 검증으로 강제한다.
OpenRouter는 endpoint별 schema 지원 차이를 명시하고, DeepSeek의 native strict tool
schema는 minItems/maxItems를 지원하지 않으므로 새 validation keyword를 무조건
추가하지 않는다. 이는 현재 OpenRouter 경로의 실패를 확인했다는 뜻은 아니다.

- [OpenRouter structured output 호환성](https://openrouter.ai/docs/guides/features/structured-outputs)
- [DeepSeek strict schema 배열 제약](https://api-docs.deepseek.com/guides/tool_calls/#array)

모델·max_tokens=500·timeout·rollout 승인 설정은 변경하지 않는다. 이 진단만으로 실제 실패 원인이나 token 부족을 확정하지
않으며, 새 버전의 live 응답/평가는 별도 관측이 필요하다.
