# RAON-239 Shadow ranking eval decision

## Decision

**2026-08-28 delivery decision:** 실제 모델 평가와 모델 선택은 후속으로 미루고,
RAON-240의 provider-neutral active ranking 경계 구현을 먼저 진행한다.

현재 저장소에는 실제 AI Gateway credential과 실행 환경이 없으므로 모델 품질·latency·cost를 측정한 것처럼 기록하지 않는다. 모델이 선택되고 active Worker 설정이 완성되기 전까지 기본 응답은 deterministic `RULE`이며, shadow runner와 미측정 항목은 후속 운영 검증 자료로 유지한다.

## Candidate set

실행 시점의 1차 후보는 다음 두 모델이다.

| Candidate | 목적 | Model ID |
| --- | --- | --- |
| Cost-sensitive | 짧은 structured ranking의 비용·latency 기준선 | `gpt-5.6-luna` |
| Balanced | 더 높은 판단 품질이 필요한지 비교 | `gpt-5.6-terra` |

두 모델은 OpenAI Responses API 모델이며 Cloudflare AI model catalog에도 등록되어 있다. 모델 지원과 가격은 바뀔 수 있으므로 runner는 model ID와 input/output MTok 가격을 환경 설정으로 받는다.

- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [Cloudflare AI model catalog](https://developers.cloudflare.com/ai/models/)
- [Cloudflare AI Gateway OpenAI endpoint](https://developers.cloudflare.com/ai-gateway/usage/providers/openai/)

## Reproducible runner

`pnpm eval:nba`는 모든 후보를 동일한 14개 golden case에 순서대로 실행하고 JSON report를 stdout으로 출력한다. 최소 두 개의 서로 다른 model ID를 요구한다.

필수 설정:

| Name | Meaning |
| --- | --- |
| `AI_EVAL_MODELS` | 쉼표로 구분한 2개 이상의 provider-native model ID |
| `AI_EVAL_PRICING_JSON` | model별 `inputUsdPerMillionTokens`, `outputUsdPerMillionTokens` |
| `AI_GATEWAY_ACCOUNT_ID` | Cloudflare account ID |
| `AI_GATEWAY_ID` | authenticated gateway ID |
| `AI_GATEWAY_TOKEN` | Worker secret 또는 로컬 비공개 환경 값 |
| `OPENAI_API_KEY` | BYOK request header를 쓸 때만 선택 |
| `AI_RECOMMENDATION_POLICY_VERSION` | 비교할 prompt/policy version |
| `AI_RECOMMENDATION_TIMEOUT_MS` | 후보별 timeout budget |

Credential과 raw provider payload는 report에 포함하지 않는다. `cf-aig-collect-log-payload: false`를 유지하므로 AI Gateway에는 token/model/status/cost/duration metadata만 남는다.

Runner report는 다음을 포함한다.

- eligibility violation, schema failure, forbidden action
- golden top-1 agreement, top-k coverage, rule disagreement
- provider first-response/total p50·p95 latency
- input/output token과 설정 가격 기반 recommendation당 추정 비용
- provider error와 timeout 비율
- case별 결과와 rationale tag

Harness self-check는 외부 provider 없이 두 fake candidate를 같은 dataset에 재생한다. 이는 runner 계산의 회귀 테스트일 뿐 모델 품질 결과가 아니다.

## Shadow production telemetry

`AI_RECOMMENDATION_MODE=shadow`에서 recommendation endpoint는 `RULE` 응답을 만든 뒤 `executionCtx.waitUntil()`에 AI ranking을 등록한다. AI 결과와 실패는 응답 DTO에 들어가지 않는다.

| Event/metric | Source |
| --- | --- |
| endpoint wall latency | `nba_shadow_completed` / `nba_shadow_failed` annotation |
| provider first response | AI `fetch()`가 response headers를 반환할 때까지 |
| provider total latency | body decode와 schema/eligibility 검증 완료까지 |
| token usage | provider Responses usage |
| shadow completion/failure | `nba_shadow_completed`, `nba_shadow_failed` |
| single-action skip | `nba_shadow_skipped` |
| Worker CPU time | Cloudflare Workers invocation log의 `cpuTimeMs` |

Worker CPU는 network wait가 제외된 platform metric을 사용한다. `Date.now()` 기반 provider latency를 CPU time으로 해석하지 않는다. `waitUntil()`은 response 이후 최대 30초 best-effort 경계이므로 bulk eval이나 장기 agent workload에는 사용하지 않는다.

- [Workers `waitUntil()` contract](https://developers.cloudflare.com/workers/runtime-apis/context/)
- [Workers CPU and wall time](https://developers.cloudflare.com/workers/platform/limits/)

## Gate assessment

| Gate | Result |
| --- | --- |
| eligibility / forbidden action violation = 0 | Adapter가 응답 적용 전 차단. Live model rate는 미측정 |
| structured output reliability | Live model report 없음 |
| deterministic 대비 ranking 개선 | 확인되지 않음 |
| p95 latency within UX budget | 확인되지 않음 |
| cost within Private Beta budget | 확인되지 않음 |
| deterministic fallback | focused test로 확인 |
| shadow failure isolation | focused Worker route test로 확인 |

## Known failure modes

- `accommodation searching`과 `transport not checked`는 publish completion상 완료로 정규화된다. 현재 provider input은 decision status와 eligible actions만 받으므로 세부 상태를 구분하지 못한다.
- Invalid schema와 out-of-eligible output은 모두 `INVALID_OUTPUT` fallback으로 폐기된다.
- `waitUntil()` 작업은 runtime 종료나 30초 제한에서 취소될 수 있으므로 shadow completion rate를 함께 본다.
- 가격은 설정 값에 따른 추정치다. 최종 비용 판단은 AI Gateway/provider billing과 대조한다.

위 미측정 항목은 모델 선택 이후 다시 측정한다. 구현 완료와 실제 모델 품질 검증은
별도 증거로 관리하며, 측정 전 결과를 통과로 기록하지 않는다.
