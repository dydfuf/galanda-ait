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
모델 기본값을 사용한다. `openrouter-v2`는 이 추천 추론 설정을 포함한 요청 버전이다.

Model ID는 Worker vars로 관리한다. 실제 ranker policy와 cache identity는
`<policy>:openrouter-v2:<model>`이므로 모델이 바뀌면 캐시도 분리된다.
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
