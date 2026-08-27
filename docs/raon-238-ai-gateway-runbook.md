# RAON-238 AI Gateway 운영 기준

## 현재 활성화 경계

RAON-238은 provider-neutral `TripActionRanker` port와 Cloudflare AI Gateway +
OpenAI Responses API adapter를 제공한다. Recommendation route는
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
AI_RECOMMENDATION_MODEL=<OpenAI model id>
AI_RECOMMENDATION_POLICY_VERSION=v1
AI_RECOMMENDATION_ACTIVE_APPROVED_POLICY_VERSION=<approved policy version>
AI_RECOMMENDATION_TIMEOUT_MS=700
AI_GATEWAY_ACCOUNT_ID=<account id>
AI_GATEWAY_ID=<gateway id>
```

`AI_GATEWAY_ACCOUNT_ID`는 Worker runtime과 `pnpm eval:nba`가 함께 사용하는
canonical account ID key다. `CLOUDFLARE_ACCOUNT_ID`는 사용하지 않는다.

`AI_GATEWAY_TOKEN`은 Worker secret으로 관리한다. OpenAI key를 request에 직접
전달하는 BYOK 환경만 `OPENAI_API_KEY` secret을 추가한다. Gateway Stored Keys 또는
Unified Billing을 사용하면 `OPENAI_API_KEY`를 Worker에 주입하지 않는다. 실제 model,
gateway ID, account ID와 credential은 staging/production 사이에서 재사용하지 않는다.

Model ID는 코드에 고정하지 않는다. 모델을 바꾸면 cache identity와 관측 구간이
분리되도록 `AI_RECOMMENDATION_POLICY_VERSION`도 함께 변경한다. `active`는
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
- 모든 요청에 `cf-aig-collect-log-payload: false`를 보내 prompt/response 저장을 막고
  Gateway의 provider/model/token/cost/status/duration metadata는 유지한다.
- Authenticated Gateway를 켜고 AI Gateway Run token을 secret으로 보관한다. 이 token은
  account-scoped이므로 계정 경계를 보안 경계로 취급한다.
- Gateway rate limit과 spend limit을 active 전환 전에 설정한다. Unified Billing을
  선택하면 prepaid credit 잔액과 월별 과금도 함께 알림 대상으로 둔다.
- Gateway retry는 `cf-aig-max-attempts: 1`, adapter wall-time은
  `AI_RECOMMENDATION_TIMEOUT_MS`로 제한한다. 외부 fetch 대기는 Worker CPU 시간이
  아니지만 사용자 응답 wall-time에는 포함된다.

## 관측과 장애 동작

Adapter는 payload 없이 provider, model, policy version, token 수, latency, HTTP status,
failure reason을 structured Worker log에 남긴다. Timeout, network/HTTP error, schema
failure, action 누락을 포함한 eligible-set 위반은 recommendation use case에서 즉시
deterministic `RULE` 결과로 fallback하며 provider retry chain은 실행하지 않는다.
