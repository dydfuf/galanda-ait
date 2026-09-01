# Galanda Collaboration & Freshness Contract

이 문서는 Galanda의 멀티 유저 협업, 데이터 최신성(Freshness), 에디터 드래프트 보호, CAS 충돌 복구, 오프라인 상태 처리 원칙을 정의한다.

---

## 1. Freshness & React Query 정책

### 1.1 기본 캐시 및 리페치 정책

| Surface | `staleTime` | `refetchOnWindowFocus` | `refetchOnReconnect` | 근거 |
|---|---|---|---|---|
| **Home Dashboard** (`/home`) | 30초 | `true` | `true` | 진입 시 최신 추천/일정 상태 유지 |
| **Trip List** (`/trips`) | 30초 | `true` | `true` | 목록 unread 뱃지 및 최신 수정 시각 반영 |
| **Trip Room Plans** (`/trips/:tripId/plans`) | 10초 | `true` | `true` | 동시 투표/의견/여행안 등록 최신화 |
| **Trip Room Itinerary** (`/trips/:tripId/itinerary`) | 10초 | `true` | `true` | 일정 수정 및 참여자 확인 최신화 |
| **Activity Feed / Drawer** | 0초 (항상 stale) | `true` | `true` | 열릴 때마다 최신 활동 sequence 조회 |
| **Explore Feed / Detail** | 60초 | `false` | `true` | 정적 피드 브라우징 최적화 |

### 1.2 Remote Query와 Dirty Draft 보호

- 사용자가 **Plan Editor** (`/trips/:tripId/plans/new`, `/edit`) 또는 **Itinerary Editor** (`/trips/:tripId/itinerary/edit`)에서 편집 중인 경우(dirty state):
  - 백그라운드 쿼리 리페치가 진행 중인 폼의 입력값(`draft state`)을 조용히 덮어쓰지 않는다.
  - 리모트 변경이 감지되면 리모트 revision 번호만 백그라운드에 업데이트하거나, 저장 시점에 CAS 충돌로 안전하게 감지한다.

---

## 2. Concurrency & CAS 충돌 복구 흐름

### 2.1 낙관적 동시성 제어 (CAS) 계약

모든 협업 변경(여행안 생성/수정/삭제, 의견 제출, 확정, 일정 수정)은 **`expectedRevision`**을 필수로 전송한다.

```text
클라이언트 (expectedRevision: N)
  → 서버 CAS 실행 (UPDATE trip_rooms SET revision = revision + 1 WHERE id = ... AND revision = N)
  → affected row = 1: 성공 (200/201)
  → affected row = 0: 409 REVISION_CONFLICT (현재 실제 revision 반환)
```

### 2.2 충돌 복구 (Conflict Recovery) UX

1. 사용자가 409 `REVISION_CONFLICT` 응답을 받으면:
   - UI는 사용자에게 `"다른 참여자가 먼저 수정했습니다"` 알림을 표시한다.
   - 사용자가 작성 중이던 로컬 드래프트를 폐기하지 않고 보존한다.
   - 최신 서버 상태를 백그라운드에서 fetch하여 최신 revision을 확보한다.
   - 사용자가 로컬 수정사항을 확인하고 다시 저장을 누르면 최신 `expectedRevision`으로 원자적 재시도를 수행한다.

---

## 3. Collaboration Activity & Unread 상태 불변식

1. **원자성 (Transaction Atomicity)**:
   - 모든 활동 이벤트(`PLAN_CREATED`, `PLAN_UPDATED`, `PLAN_DELETED`, `OPINION_SUBMITTED`, `OPINION_UPDATED`, `PLAN_CONFIRMED`, `ITINERARY_REVISED`)는 aggregate mutation과 동일한 DB transaction에서 기록된다.
   - CAS 실패, validation 실패, 권한 오류 시 activity 이벤트가 생성되지 않는다.
2. **자신의 행동 제외 (Own Action Exclusion)**:
   - 본인이 생성한 활동 이벤트는 본인의 unread count에 포함되지 않는다.
3. **영속적 커서 (Persistent Read Cursor)**:
   - 사용자가 활동 내역을 확인하면 `PUT /api/trips/:tripId/activity/read` (`throughSequence`)를 호출하여 서버 DB `trip_activity_reads`에 watermark를 기록한다.
   - 새로고침이나 다른 기기에서도 읽음 상태가 일관되게 유지된다.
4. **신규 참여자 격리 (Join Boundary)**:
   - 방에 새로 초대되어 참여한 사용자는 참여 시점의 `latestSequence`를 초기 cursor로 부여받아, 참여 이전의 모든 과거 활동이 unread로 쌓이지 않는다.

---

## 4. Offline & 네트워크 장애 UX 원칙

1. **거짓 성공 상태 금지**:
   - 오프라인 상태에서 발생한 변경을 `"저장됨"` 또는 확정으로 표시하지 않는다.
   - 네트워크 연결이 끊긴 상태에서 캐시된 데이터를 보여줄 경우, `"마지막 동기화 시각"` 또는 `"오프라인 상태입니다"` 안내를 명시한다.
2. **파괴적/Stale Mutation 비활성화**:
   - 오프라인 감지 시 폼 저장 버튼에 로딩/비활성화 처리 또는 오프라인 경고를 노출한다.
3. **네트워크 복구 시 자동 재시도**:
   - `window.addEventListener("online")` 시 React Query의 `refetchOnReconnect`로 서버의 최신 상태를 자동 동기화한다.
