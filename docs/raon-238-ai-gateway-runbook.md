# RAON-238 AI Gateway 운영 기준

## 현재 활성화 경계

RAON-238은 provider-neutral `TripActionRanker` port와 Cloudflare AI Gateway +
OpenAI Responses API adapter를 제공한다. Production recommendation route에는 아직
adapter layer를 주입하지 않으므로 응답은 계속 `RULE`이다. Shadow 실행은 RAON-239,
사용자 응답에 AI ranking을 반영하는 active 전환은 RAON-240에서 각각 다룬다.

## Worker 설정

활성화 작업에서는 다음 non-secret 설정을 환경별 Worker vars로 주입한다.

```text
AI_RECOMMENDATION_MODE=off|shadow|active
AI_RECOMMENDATION_MODEL=<OpenAI model id>
AI_RECOMMENDATION_POLICY_VERSION=v1
AI_RECOMMENDATION_TIMEOUT_MS=700
CLOUDFLARE_ACCOUNT_ID=<account id>
AI_GATEWAY_ID=<gateway id>
```

`AI_GATEWAY_TOKEN`은 Worker secret으로 관리한다. OpenAI key를 request에 직접
전달하는 BYOK 환경만 `OPENAI_API_KEY` secret을 추가한다. Gateway Stored Keys 또는
Unified Billing을 사용하면 `OPENAI_API_KEY`를 Worker에 주입하지 않는다. 실제 model,
gateway ID, account ID와 credential은 staging/production 사이에서 재사용하지 않는다.

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
failure, eligible-set 위반은 recommendation use case에서 즉시 deterministic `RULE`
결과로 fallback하며 provider retry chain은 실행하지 않는다.
