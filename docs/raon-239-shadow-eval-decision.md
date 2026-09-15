# RAON-239 Shadow ranking eval decision

## Decision

**Active rollout gate: NO-GO.** 사용자 응답은 계속 deterministic `RULE` 결과를 사용한다.

2026-09-16 KST에 실제 Worker AI 바인딩 → `galanda-staging-ai` → OpenRouter
BYOK 경로로 두 모델을 비교했다. 연결은 정상이나 5초 제한에서 timeout과 잘못된
출력이 관측되었고, deterministic 대비 개선 근거가 없어 active를 유지 보류한다.

## Candidate set 및 실제 결과

동일한 golden 14개를 모델마다 평가했다. 후보 하나인 6개는 생략하고 8개를 호출했다.

| Model ID | 완료 / 호출 | 실패 | 전체 p50 / p95 | 관측 usage 기반 비용 합계 |
| --- | --- | --- | --- | --- |
| `openai/gpt-4.1-mini` | 5 / 8 | TIMEOUT 3 | 3316 / 5000 ms | $0.000782 |
| `google/gemini-2.5-flash-lite` | 7 / 8 | INVALID_OUTPUT 1 | 839 / 2205 ms | $0.0002854 |

완료된 응답의 golden top-1/top-k 일치율은 두 모델 모두 100%, rule disagreement는
0이었다. 검증된 응답에서 후보 범위·금지 행동 위반은 없었다. INVALID_OUTPUT은
적용 전에 폐기하므로 그 응답의 세부 위반 분류를 이 수치로 주장하지 않는다.
작은 표본의 단일 실행이며 일반적인 품질·지연 보장은 아니다.

보고서 생성 시각은 `2026-09-15T17:50:49.379Z`, policy `v1`, timeout 5000ms다.
입력/출력 100만 token당 가격은 각각 $0.40/$1.60, $0.10/$0.40을 사용했다.
GPT 관측량은 입력 1327 / 출력 157, Gemini는 입력 1286 / 출력 392 token이다.
Timeout으로 usage를 받지 못한 호출은 비용에 포함되지 않아 실제 청구액은 다를 수 있다.

- [OpenRouter 모델·가격 API](https://openrouter.ai/api/v1/models)
- [Cloudflare OpenRouter endpoint](https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/)
- [AI Gateway Worker binding](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)

## Reproducible runner

`pnpm eval:nba`는 모든 후보를 동일한 14개 golden case에 순서대로 실행하고 JSON report를 stdout으로 출력한다. 최소 두 개의 서로 다른 model ID를 요구한다.

필수 설정:

| Name | Meaning |
| --- | --- |
| `AI_EVAL_MODELS` | 쉼표로 구분한 2개 이상의 provider-native model ID |
| `AI_EVAL_PRICING_JSON` | model별 `inputUsdPerMillionTokens`, `outputUsdPerMillionTokens` |
| `AI_GATEWAY_ID` | authenticated gateway ID |
| `AI_RECOMMENDATION_POLICY_VERSION` | 비교할 prompt/policy version |
| `AI_RECOMMENDATION_TIMEOUT_MS` | 후보별 timeout budget |

현재 추천 adapter는 `reasoning.effort: low`를 명시하므로 이 옵션을 지원하는
모델을 선택한다. 다음 명령은 과거 기본 추론 비교 당시의 재현 설정이다.

먼저 `pnpm exec wrangler login`으로 Gateway와 같은 Cloudflare 계정에 로그인한다.
Runner는 AI 바인딩만 가진 비공개 remote preview를 만들고 고정 golden dataset을
Worker 내부에서 평가한 후 preview를 종료한다. 앱 Worker를 배포하거나 DB에
접근하지 않는다. 여러 계정을 사용한다면 Wrangler의 `CLOUDFLARE_ACCOUNT_ID`로
대상을 선택한다. Node의 `getPlatformProxy().env.AI.gateway().run()` 직접 호출은
로컬 RPC bridge에서 멈출 수 있어 사용하지 않는다.

```bash
AI_GATEWAY_ID=galanda-staging-ai \
AI_RECOMMENDATION_POLICY_VERSION=v1 \
AI_RECOMMENDATION_TIMEOUT_MS=5000 \
AI_EVAL_MODELS=openai/gpt-4.1-mini,google/gemini-2.5-flash-lite \
AI_EVAL_PRICING_JSON='{"openai/gpt-4.1-mini":{"inputUsdPerMillionTokens":0.4,"outputUsdPerMillionTokens":1.6},"google/gemini-2.5-flash-lite":{"inputUsdPerMillionTokens":0.1,"outputUsdPerMillionTokens":0.4}}' \
pnpm --silent eval:nba > /tmp/galanda-ranking-eval.json
```

Credential과 raw provider payload는 report에 포함하지 않는다. 사용자 요청으로
현재 adapter는 `cf-aig-collect-log-payload: true`를 사용하므로 Gateway에는
요청·응답 본문과 metadata가 저장된다. 위 과거 평가 시점에는 본문 저장이 꺼져 있었다.

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
| provider first response | AI Gateway binding이 response headers를 반환할 때까지 |
| provider total latency | body decode와 schema/eligibility 검증 완료까지 |
| token usage | OpenRouter Chat Completions usage |
| shadow completion/failure | `nba_shadow_completed`, `nba_shadow_failed` |
| single-action skip | `nba_shadow_skipped` |
| Worker CPU time | Cloudflare Workers invocation log의 `cpuTimeMs` |

Worker CPU는 network wait가 제외된 platform metric을 사용한다. `Date.now()` 기반 provider latency를 CPU time으로 해석하지 않는다. `waitUntil()`은 response 이후 최대 30초 best-effort 경계이므로 bulk eval이나 장기 agent workload에는 사용하지 않는다.

- [Workers `waitUntil()` contract](https://developers.cloudflare.com/workers/runtime-apis/context/)
- [Workers CPU and wall time](https://developers.cloudflare.com/workers/platform/limits/)

## Gate assessment

| Gate | Result |
| --- | --- |
| eligibility / forbidden action violation = 0 | Adapter가 적용 전 차단. 완료된 응답에서 0건 |
| structured output reliability | GPT timeout 3/8, Gemini invalid output 1/8 |
| deterministic 대비 ranking 개선 | 완료된 응답은 RULE과 동일, 개선 미확인 |
| p95 latency within UX budget | 5초 제한에서 GPT timeout 발생, active 미승인 |
| cost within Private Beta budget | 관측 usage만 추정, timeout 청구 비용·운영 예산 미검증 |
| deterministic fallback | focused test로 확인 |
| shadow failure isolation | focused Worker route test로 확인 |

## Known failure modes

- `accommodation searching`과 `transport not checked`는 publish completion상 완료로 정규화된다. 현재 provider input은 decision status와 eligible actions만 받으므로 세부 상태를 구분하지 못한다.
- Invalid schema와 out-of-eligible output은 모두 `INVALID_OUTPUT` fallback으로 폐기된다.
- `waitUntil()` 작업은 runtime 종료나 30초 제한에서 취소될 수 있으므로 shadow completion rate를 함께 본다.
- 가격은 설정 값에 따른 추정치다. 최종 비용 판단은 AI Gateway/provider billing과 대조한다.

실제 report의 실패율·지연을 개선하고 운영 예산 검토까지 gate가 모두 통과하기 전에는 RAON-240 active ranking을 시작하지 않는다.

## DeepSeek 후속 비교 (2026-09-16 KST)

사용자 요청으로 staging의 자료함·추천 모델을 `deepseek/deepseek-v4.1-flash`로
변경했다. 요청 형식, 모델의 기본 추론 설정, timeout과 shadow 경계는 유지했다.

`2026-09-15T18:03:14.293Z` 보고서의 동일 14개 case 중 각 8개 실제 호출 결과:

| Model | 완료 | TIMEOUT | 전체 p50 / p95 |
| --- | --- | --- | --- |
| `deepseek/deepseek-v4.1-flash` | 3 / 8 | 5 / 8 | 5000 / 5001 ms |
| `openai/gpt-4.1-mini` | 4 / 8 | 4 / 8 | 3390 / 5001 ms |

완료된 응답의 top-1/top-k 일치율은 두 모델 모두 100%다. DeepSeek 완료 응답 중
1개는 RULE과 다른 허용된 선택을 했다. 5초 제한의 실패율이 높으므로 active는
계속 NO-GO다. Timeout 응답에는 usage가 없어 비용·token 합계는 실제 전체 청구량을
대표하지 않는다. 모델 catalog의 기본 추론은 enabled/high이며 이번 비교에서는
이를 낮추거나 끄지 않았다.

30초 제한의 자료함 adapter는 실제 DeepSeek 메모 추출 2건 모두 성공했다
(27936ms, 16342ms). 긴 추론이나 provider 지연이 있으면 30초를 넘을 수 있다.

- [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash)


## 추천 추론 수준 low (2026-09-16 KST)

사용자 요청으로 다음 행동 추천에만 `reasoning: { "effort": "low" }`를 추가했다.
자료함 요청은 이 필드를 보내지 않아 모델 기본 추론 설정을 유지한다.
캐시·fingerprint의 요청 버전은 `openrouter-v2`로 분리했다.

실제 DeepSeek Worker binding으로 같은 두 후보(`DEFINE_ROUTE`, `INVITE_MEMBER`)를
3회 호출했다. 응답 완료까지 4686ms / 4707ms / 3885ms로 timeout은 없었지만,
유효한 추천은 1건이고 나머지 2건은 `INVALID_OUTPUT`으로 폐기됐다. 첫 응답은
`DEFINE_ROUTE`, 대안 `INVITE_MEMBER`, 사유 `DEFINE_TRAVEL_ROUTE`였다.
이는 한 입력의 연결 확인이며 전체 golden 평가나 품질 개선 증거가 아니다.
5초 제한과 shadow 모드, 서버의 schema·eligible action 검증은 유지한다.
