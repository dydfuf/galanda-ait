# Explore theme taxonomy

RAON-271에서 도입한 Explore 분류의 source of truth는
`src/core/domain/explore-theme.ts`다. 이 문서는 운영·변경 정책과 public contract를
설명하며, 실행 가능한 ID/validation 목록은 해당 모듈을 따른다.

## v1 taxonomy

| Stable ID | 표시명 |
| --- | --- |
| `food` | 미식 |
| `relaxation` | 휴양 |
| `nature` | 자연 |
| `culture` | 문화·예술 |
| `activity` | 액티비티 |
| `family` | 가족 |
| `city` | 도시 |
| `shopping` | 쇼핑 |

한 listing에는 중복 없이 최대 3개를 선택할 수 있다. client command는 ID만 보내며
표시명이나 임의 문자열을 제출할 수 없다. 서버는 allowlist 검증 후 taxonomy 순서로
정규화해 public snapshot의 `themeIds`에 저장한다.

## Snapshot과 필터 의미

- 테마는 destination·제목·숙소 등 다른 문자열에서 추론하지 않는다.
- 기존 snapshot에 `themeIds`가 없으면 “분류 없음”이며 UI는 chip을 만들지 않는다.
- `themeId` feed filter는 전체 eligible `LISTED` public snapshot에 적용한다.
- private Trip/Plan/member data를 aggregate 또는 fallback으로 읽지 않는다.
- 최초 게시와 재게시에서 작성자가 선택할 수 있다.
- 게시 후 분류 수정은 listing `expectedRevision` compare-and-set command를 사용한다.
  source-derived snapshot 내용과 `listedAt`은 유지하고 theme IDs, listing revision,
  `updatedAt`만 바꾼다.

## 변경·폐기 정책

Stable ID는 URL, cache key, cursor identity와 persisted snapshot에 저장되므로 삭제하거나
다른 의미로 재사용하지 않는다. 새 테마는 additive하게 추가한다. 테마를 신규 선택에서
제외할 때는 taxonomy의 `selectable`을 false로 바꾸되 ID와 표시명 decoder는 유지해 기존
snapshot이 계속 읽히도록 한다. 표시명 변경은 ID 의미를 바꾸지 않는 범위에서만 하며,
기존 snapshot은 ID만 저장하므로 현재 server-owned 표시명을 사용한다.

분류를 자동으로 소급 적용하지 않는다. 기존 listing은 작성자의 명시적 분류 수정 또는
재게시 전까지 분류 없음 상태를 유지한다.
