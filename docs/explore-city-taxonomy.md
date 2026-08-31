# Explore 도시 taxonomy

Explore의 `destination`과 `routes[].city`는 표시용 문자열로 유지한다. 공개
listing의 route city만 아래 server-owned canonical ID로 sidecar index화하며,
private TripRoom/TripPlan은 정규화하지 않는다.

## v1

| ID | Label | Alias |
| --- | --- | --- |
| `seoul` | 서울 | 서울, 서울시, seoul |
| `busan` | 부산 | 부산, 부산시, busan |
| `jeju` | 제주 | 제주, 제주도, 제주시, jeju |
| `tokyo` | 도쿄 | 도쿄, 동경, tokyo |
| `osaka` | 오사카 | 오사카, osaka |
| `kyoto` | 교토 | 교토, kyoto |
| `nagoya` | 나고야 | 나고야, nagoya |
| `hakone` | 하코네 | 하코네, hakone |
| `yokohama` | 요코하마 | 요코하마, yokohama |

정규화는 Unicode NFKC, 앞뒤 공백 제거, 연속 whitespace의 한 칸 축약,
locale-independent lowercase 순서로 적용한 뒤 alias 전체 문자열을 exact match한다.
substring/fuzzy match, 외부 geocoder, destination/stay/transport 기반 추론은 하지
않는다. unknown 문자열은 표시용 snapshot에 그대로 남고 canonical index와 filter에서
제외한다.

ID는 public URL/API/cache의 stable contract다. 기존 ID의 의미를 재사용하거나
삭제하지 않는다. alias/label 추가가 historical row에 영향을 주면 별도의 idempotent
backfill migration을 추가한다.
