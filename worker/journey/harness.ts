/**
 * In-process release-journey harness (RAON-258 / Goal 14 DISC-10).
 *
 * 이 harness는 **테스트 코드 전용**이다. production 코드에 test bypass
 * endpoint/hook을 추가하지 않고, 실제 production `createApp` / route / Effect
 * use case / Drizzle repository / DTO validation / SQL 생성을 그대로 통과시킨다.
 * 여기서 대체하는 유일한 지점은 pg wire(=`NodePgClient.query`)뿐이며, 그것도
 * 실제 repository가 생성한 parameterized SQL을 상태 있게 실행하는 in-memory
 * store로 구현한다(가짜 product data/popularity/image/count 없음).
 *
 * ## 무엇을 실제로 실행하는가
 * - `worker/app.ts`의 production `createApp` + 모든 route/middleware
 * - `src/core/usecases/*` Effect use case (auth-guard/CAS/idempotency 포함)
 * - `src/infrastructure/persistence/drizzle/*` repository가 만든 실제 SQL
 * - Effect Schema request/response validation, opaque cursor 발급/해독
 *
 * ## 대체하는 것
 * - `NodePgClient.query(config, params)` 한 지점. drizzle node-postgres session이
 *   row-mode "array"로 결과를 요구하므로(field-mapped select) 컬럼 순서대로 배열
 *   row를 돌려준다. write/transaction/`for update`/`returning`/`on conflict`/
 *   keyset/`min` group-by/inner join을 실제 param으로 상태 있게 처리한다.
 *
 * ## Auth
 * - `resolveParticipantIdentity`를 주입해 request header(`x-test-session`)로 지정한
 *   participant identity로 session을 전환한다. private field/actor는 서버가 소유하고
 *   client가 spoof할 수 없다는 계약을 그대로 유지한다.
 */
import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import * as schema from "../../src/infrastructure/persistence/drizzle/schema/index.ts";
import type { DatabaseHandle } from "../../src/infrastructure/persistence/drizzle/database.ts";
import {
  createApp,
  type AppDependencies,
  type AppEnv,
} from "../app.ts";
import { ParticipantIdSchema } from "../../src/core/domain/ids.ts";
import type { ExplorePlanSnapshot } from "../../src/core/domain/explore-plan.ts";

// --- in-memory row shapes (server-side storage, private) --------------------

export interface TripRoomRecord {
  id: string;
  title: string;
  destination: string;
  revision: number;
  members: unknown;
  plans: unknown;
  confirmedPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExploreListingRecord {
  id: string;
  sourceTripId: string;
  sourcePlanId: string;
  sourceAuthorParticipantId: string;
  snapshot: ExplorePlanSnapshot;
  status: string;
  listingRevision: number;
  sourcePlanRevision: number;
  listedAt: string;
  updatedAt: string;
  unlistedAt: string | null;
  /** Test seed for the persisted sidecar rows. */
  cityIds?: readonly string[];
}

export interface ExploreSaveRecord {
  participantId: string;
  listingId: string;
  saveCycle?: number;
  savedAt: string;
  unsavedAt?: string | null;
}

export interface ParticipantAliasRecord {
  aliasParticipantId: string;
  canonicalParticipantId: string;
}

interface Store {
  tripRooms: Map<string, TripRoomRecord>;
  exploreListings: Map<string, ExploreListingRecord>;
  exploreListingCities: Map<string, Set<string>>;
  exploreSaves: ExploreSaveRecord[];
  participantAliases: ParticipantAliasRecord[];
  registeredParticipantIds: Set<string>;
  /**
   * 테스트 전용 one-shot 훅. 다음 explore listing INSERT가 실행되기 "직전"에 한 번
   * 호출된다(그 뒤 자동 해제). concurrent first-list race를 결정론적으로 재현하는
   * 데 쓴다: loser가 findBySource===none을 통과한 뒤 INSERT에 도달하기 직전에
   * winner의 row를 심으면, loser의 INSERT가 실제 unique 충돌 경로(ON CONFLICT DO
   * NOTHING → 0 rows → 기존 row 재조회)를 그대로 밟는다. production 코드에는 어떤
   * 훅도 없으며, 이 필드는 harness store에만 존재한다.
   */
  beforeNextListingInsert?: () => void;
}

const cloneStore = (store: Store): Store => ({
  tripRooms: new Map([...store.tripRooms].map(([k, v]) => [k, { ...v }])),
  exploreListings: new Map(
    [...store.exploreListings].map(([k, v]) => [k, { ...v }])
  ),
  exploreListingCities: new Map(
    [...store.exploreListingCities].map(([k, v]) => [k, new Set(v)])
  ),
  exploreSaves: store.exploreSaves.map((row) => ({ ...row })),
  participantAliases: store.participantAliases.map((row) => ({ ...row })),
  registeredParticipantIds: new Set(store.registeredParticipantIds),
  beforeNextListingInsert: store.beforeNextListingInsert,
});

const restoreStore = (target: Store, source: Store): void => {
  target.tripRooms = source.tripRooms;
  target.exploreListings = source.exploreListings;
  target.exploreListingCities = source.exploreListingCities;
  target.exploreSaves = source.exploreSaves;
  target.participantAliases = source.participantAliases;
  target.registeredParticipantIds = source.registeredParticipantIds;
  target.beforeNextListingInsert = source.beforeNextListingInsert;
};

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

// timestamp 컬럼은 drizzle이 driver string을 `new Date(...)`로 매핑하므로
// store에는 ISO string으로 저장하고 그대로 돌려준다(실제 pg driver 동작과 동일).
const rowToTripRoomArray = (r: TripRoomRecord): unknown[] => [
  r.id,
  r.title,
  r.destination,
  r.revision,
  r.members,
  r.plans,
  r.confirmedPlanId,
  r.createdAt,
  r.updatedAt,
];

const rowToListingArray = (r: ExploreListingRecord): unknown[] => [
  r.id,
  r.sourceTripId,
  r.sourcePlanId,
  r.sourceAuthorParticipantId,
  r.snapshot,
  r.status,
  r.listingRevision,
  r.sourcePlanRevision,
  r.listedAt,
  r.updatedAt,
  r.unlistedAt,
];

const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value);

const canonicalParticipantId = (store: Store, participantId: string): string =>
  store.participantAliases.find((a) => a.aliasParticipantId === participantId)
    ?.canonicalParticipantId ?? participantId;

const isActiveSave = (save: ExploreSaveRecord): boolean =>
  save.unsavedAt == null;

const saveCount = (
  store: Store,
  listingId: string,
  asOf?: string
): number => {
  const canonicalIds = new Set<string>();
  const anchor = asOf ? new Date(asOf).getTime() : undefined;
  for (const save of store.exploreSaves) {
    if (save.listingId !== listingId) continue;
    const canonicalId = canonicalParticipantId(store, save.participantId);
    if (!store.registeredParticipantIds.has(canonicalId)) continue;
    if (anchor === undefined) {
      if (!isActiveSave(save)) continue;
    } else {
      const savedAt = new Date(save.savedAt).getTime();
      const unsavedAt = save.unsavedAt ? new Date(save.unsavedAt).getTime() : null;
      if (
        !(savedAt > anchor - 30 * 24 * 60 * 60 * 1000) ||
        !(savedAt <= anchor) ||
        !(unsavedAt === null || unsavedAt > anchor)
      ) {
        continue;
      }
    }
    canonicalIds.add(canonicalId);
  }
  return canonicalIds.size;
};

const rowToPublicListingArray = (
  r: ExploreListingRecord,
  count: number
): unknown[] => [
  r.id,
  r.sourceTripId,
  r.sourcePlanId,
  r.sourceAuthorParticipantId,
  r.status,
  r.listingRevision,
  r.sourcePlanRevision,
  r.snapshot,
  r.listedAt,
  r.updatedAt,
  r.unlistedAt,
  count,
];

/**
 * SQL executor.
 *
 * 실제 repository가 만든 parameterized SQL의 안정적인 fingerprint(테이블명 +
 * 연산 + 특징 절)로 dispatch한다. `_probe`로 확인한 실제 SQL 문자열을 근거로
 * 하며, param 값을 그대로 사용해 상태를 읽고 쓴다.
 */
class QueryEngine {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  execute(rawText: string, params: readonly unknown[]): { rows: unknown[][] } {
    const text = normalize(rawText);

    if (
      text.includes('from "participant_alias"') &&
      !text.includes('"explore_plan_saves"')
    ) {
      const ids = new Set(params.map((p) => String(p)));
      const rows = this.store.participantAliases
        .filter((a) => ids.has(a.aliasParticipantId))
        .map((a) => [a.aliasParticipantId, a.canonicalParticipantId]);
      return { rows };
    }

    if (text.includes('"trip_rooms"')) {
      return this.executeTripRooms(text, params);
    }

    if (
      text.startsWith('insert into "explore_listing_cities"') ||
      text.startsWith('delete from "explore_listing_cities"') ||
      (text.includes("group by") &&
        text.includes('"explore_listing_cities"'))
    ) {
      return this.executeListingCities(text, params);
    }

    if (text.includes("deduped_saves")) {
      return this.executeSaves(text, params);
    }

    if (text.includes('"explore_plan_listings"')) {
      return this.executeListings(text, params);
    }

    if (text.includes('"explore_plan_saves"')) {
      return this.executeSaves(text, params);
    }

    throw new Error(`Unrecognized SQL in journey harness: ${text}`);
  }

  private executeTripRooms(
    text: string,
    params: readonly unknown[]
  ): { rows: unknown[][] } {
    // getRooms: members @> jsonb OR ... order by created_at desc
    if (text.startsWith("select") && text.includes("@>")) {
      const wanted = params.map((p) => {
        const parsed = JSON.parse(String(p)) as Array<{ id: string }>;
        return parsed[0]!.id;
      });
      const rows = [...this.store.tripRooms.values()]
        .filter((room) =>
          (room.members as Array<{ id: string }>).some((m) =>
            wanted.includes(m.id)
          )
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(rowToTripRoomArray);
      return { rows };
    }

    // select "plans" ... for update (create() lock)
    if (
      text.startsWith('select "plans" from "trip_rooms"') &&
      text.includes("for update")
    ) {
      const room = this.store.tripRooms.get(String(params[0]));
      return { rows: room ? [[room.plans]] : [] };
    }

    // select "revision" (findRevision)
    if (text.startsWith('select "revision" from "trip_rooms"')) {
      const room = this.store.tripRooms.get(String(params[0]));
      return { rows: room ? [[room.revision]] : [] };
    }

    // select full row where id = $1 (getRoom)
    if (text.startsWith('select "id"') && text.includes('from "trip_rooms"')) {
      const room = this.store.tripRooms.get(String(params[0]));
      return { rows: room ? [rowToTripRoomArray(room)] : [] };
    }

    // insert into trip_rooms ... on conflict (id) do nothing returning ...
    if (text.startsWith('insert into "trip_rooms"')) {
      const [id, title, destination, members, plans] = params as [
        string,
        string,
        string,
        string,
        string,
      ];
      if (this.store.tripRooms.has(id)) {
        return { rows: [] };
      }
      const now = new Date().toISOString();
      const record: TripRoomRecord = {
        id,
        title,
        destination,
        revision: 1,
        members: JSON.parse(members),
        plans: JSON.parse(plans),
        confirmedPlanId: null,
        createdAt: now,
        updatedAt: now,
      };
      this.store.tripRooms.set(id, record);
      return { rows: [rowToTripRoomArray(record)] };
    }

    // update trip_rooms set ... revision + 1 where id and revision returning ... (CAS)
    if (text.startsWith('update "trip_rooms"')) {
      const [title, destination, members, plans, confirmedPlanId, id, expected] =
        params as [
          string,
          string,
          string,
          string,
          string | null,
          string,
          number,
        ];
      const room = this.store.tripRooms.get(id);
      if (!room || room.revision !== expected) {
        return { rows: [] };
      }
      room.title = title;
      room.destination = destination;
      room.members = JSON.parse(members);
      room.plans = JSON.parse(plans);
      room.confirmedPlanId = confirmedPlanId ?? null;
      room.revision += 1;
      room.updatedAt = new Date().toISOString();
      return { rows: [rowToTripRoomArray(room)] };
    }

    throw new Error(`Unrecognized trip_rooms SQL: ${text}`);
  }

  private executeListings(
    text: string,
    params: readonly unknown[]
  ): { rows: unknown[][] } {
    // save transaction listing lock: status is the only selected column.
    if (text.startsWith('select "status"') && text.includes("for update")) {
      const row = this.store.exploreListings.get(String(params[0]));
      return { rows: row ? [[row.status]] : [] };
    }

    // public detail: the listing row is read together with its authoritative count.
    if (
      text.startsWith('select "id"') &&
      text.includes('where "explore_plan_listings"."id" = $1') &&
      text.includes("count(distinct")
    ) {
      const row = this.store.exploreListings.get(String(params[0]));
      return { rows: row ? [rowToPublicListingArray(row, saveCount(this.store, row.id))] : [] };
    }

    // getById: where id = $1, full projection incl. source_*
    if (
      text.startsWith('select "id"') &&
      text.includes('where "explore_plan_listings"."id" = $1')
    ) {
      const row = this.store.exploreListings.get(String(params[0]));
      return { rows: row ? [rowToListingArray(row)] : [] };
    }

    // findBySource: where source_trip_id=$1 and source_plan_id=$2
    if (
      text.startsWith("select") &&
      text.includes('"source_trip_id" = $1') &&
      text.includes('"source_plan_id" = $2')
    ) {
      const [tripId, planId] = params as [string, string];
      const row = [...this.store.exploreListings.values()].find(
        (l) => l.sourceTripId === tripId && l.sourcePlanId === planId
      );
      return { rows: row ? [rowToListingArray(row)] : [] };
    }

    // listListed feed: ranked save activity + recency tie-break + limit.
    if (
      text.startsWith('select "id"') &&
      text.includes('"status"') &&
      text.includes("ranked_save") &&
      text.includes("order by")
    ) {
      const status = String(params.find((p) => p === "LISTED") ?? "LISTED");
      const dateParams = params.filter(
        (p): p is Date => p instanceof Date
      );
      const rankedAt = dateParams[1]?.toISOString() ?? new Date().toISOString();
      let rows = [...this.store.exploreListings.values()].filter((l) => l.status === status);
      const cityPlaceholder = /city\.city_id = \$(\d+)/.exec(text);
      if (cityPlaceholder) {
        const cityId = String(params[Number(cityPlaceholder[1]) - 1]);
        rows = rows.filter((l) =>
          this.store.exploreListingCities.get(l.id)?.has(cityId)
        );
      }
      const ranked = rows.map((listing) => ({
        listing,
        rankScore: saveCount(this.store, listing.id, rankedAt),
      }));
      const maxRankScore = Math.max(0, ...ranked.map((row) => row.rankScore));
      const cursorRank = params.filter((p) => typeof p === "number");
      const listedAtPlaceholder = /"listed_at" < \$(\d+)/.exec(text);
      const idPlaceholder = /"id" < \$(\d+)/.exec(text);
      const cursorListedAt = listedAtPlaceholder
        ? String(params[Number(listedAtPlaceholder[1]) - 1])
        : undefined;
      const cursorId = idPlaceholder
        ? String(params[Number(idPlaceholder[1]) - 1])
        : undefined;
      const cursorRankScore = cursorRank.length > 1 ? Number(cursorRank[0]) : undefined;
      const pageRows = ranked
        .filter(({ rankScore, listing }) =>
          cursorRankScore === undefined
            ? true
            : rankScore < cursorRankScore ||
              (rankScore === cursorRankScore &&
                (listing.listedAt < String(cursorListedAt) ||
                  (listing.listedAt === cursorListedAt && listing.id < String(cursorId))))
        )
        .sort((a, b) =>
          a.rankScore !== b.rankScore
            ? b.rankScore - a.rankScore
            : a.listing.listedAt !== b.listing.listedAt
              ? a.listing.listedAt < b.listing.listedAt
                ? 1
                : -1
              : a.listing.id < b.listing.id
                ? 1
                : -1
        );
      const limit = Number(params[params.length - 1]);
      return {
        rows: pageRows.slice(0, limit).map(({ listing, rankScore }) => [
          ...rowToPublicListingArray(listing, saveCount(this.store, listing.id)),
          rankScore,
          maxRankScore,
        ]),
      };
    }

    // select "listing_revision" ... where id=$1 (compareAndSet conflict probe)
    if (text.startsWith('select "listing_revision"')) {
      const row = this.store.exploreListings.get(String(params[0]));
      return { rows: row ? [[row.listingRevision]] : [] };
    }

    // insert into explore_plan_listings ... on conflict (source) do nothing returning id
    if (text.startsWith('insert into "explore_plan_listings"')) {
      // 테스트 전용 one-shot interleave: INSERT 실행 직전에 winner row를 심어
      // 실제 unique 충돌 경로를 결정론적으로 재현한다(그 뒤 훅 자동 해제).
      if (this.store.beforeNextListingInsert) {
        const hook = this.store.beforeNextListingInsert;
        this.store.beforeNextListingInsert = undefined;
        hook();
      }
      const [
        id,
        sourceTripId,
        sourcePlanId,
        sourceAuthorParticipantId,
        snapshot,
        status,
        listingRevision,
        sourcePlanRevision,
        listedAt,
        updatedAt,
        unlistedAt,
      ] = params as [
        string,
        string,
        string,
        string,
        string,
        string,
        number,
        number,
        string,
        string,
        string | null,
      ];
      // unique index (source_trip_id, source_plan_id) 충돌: 실제 ON CONFLICT DO
      // NOTHING처럼 예외 없이 0 rows returning으로 흡수한다(concurrent first-list
      // loser). raw 예외를 던지지 않으므로 RepositoryError(503)로 새지 않는다.
      if (
        [...this.store.exploreListings.values()].some(
          (l) =>
            l.sourceTripId === sourceTripId && l.sourcePlanId === sourcePlanId
        )
      ) {
        return { rows: [] };
      }
      this.store.exploreListings.set(id, {
        id,
        sourceTripId,
        sourcePlanId,
        sourceAuthorParticipantId,
        snapshot:
          typeof snapshot === "string"
            ? (JSON.parse(snapshot) as ExplorePlanSnapshot)
            : (snapshot as ExplorePlanSnapshot),
        status,
        listingRevision,
        sourcePlanRevision,
        listedAt,
        updatedAt,
        unlistedAt: unlistedAt ?? null,
      });
      // RETURNING "id" → 정상 삽입은 1 row.
      return { rows: [[id]] };
    }

    // update explore_plan_listings set ... where id and listing_revision returning listing_revision (CAS)
    if (
      text.startsWith('update "explore_plan_listings"') &&
      text.includes("returning")
    ) {
      const [
        snapshot,
        status,
        listingRevision,
        sourcePlanRevision,
        listedAt,
        updatedAt,
        unlistedAt,
        id,
        expected,
      ] = params as [
        string,
        string,
        number,
        number,
        string,
        string,
        string | null,
        string,
        number,
      ];
      const row = this.store.exploreListings.get(id);
      if (!row || row.listingRevision !== expected) {
        return { rows: [] };
      }
      row.snapshot =
        typeof snapshot === "string"
          ? (JSON.parse(snapshot) as ExplorePlanSnapshot)
          : (snapshot as ExplorePlanSnapshot);
      row.status = status;
      row.listingRevision = listingRevision;
      row.sourcePlanRevision = sourcePlanRevision;
      row.listedAt = listedAt;
      row.updatedAt = updatedAt;
      row.unlistedAt = unlistedAt ?? null;
      return { rows: [[row.listingRevision]] };
    }

    // update explore_plan_listings set status=UNLISTED ... where source plan LISTED (auto-unlist, no returning)
    if (text.startsWith('update "explore_plan_listings"')) {
      // params: status=$1, updated_at=$2, unlisted_at=$3, source_trip_id=$4, source_plan_id=$5, status='LISTED'=$6
      const status = String(params[0]);
      const updatedAt = String(params[1]);
      const unlistedAt = String(params[2]);
      const sourceTripId = String(params[3]);
      const sourcePlanId = String(params[4]);
      for (const row of this.store.exploreListings.values()) {
        if (
          row.sourceTripId === sourceTripId &&
          row.sourcePlanId === sourcePlanId &&
          row.status === "LISTED"
        ) {
          row.status = status;
          row.listingRevision += 1;
          row.updatedAt = updatedAt;
          row.unlistedAt = unlistedAt;
        }
      }
      return { rows: [] };
    }

    throw new Error(`Unrecognized explore_plan_listings SQL: ${text}`);
  }

  private executeListingCities(
    text: string,
    params: readonly unknown[]
  ): { rows: unknown[][] } {
    if (text.startsWith('insert into "explore_listing_cities"')) {
      for (let index = 0; index < params.length; index += 2) {
        const listingId = String(params[index]);
        const cityId = String(params[index + 1]);
        const cityIds = this.store.exploreListingCities.get(listingId) ?? new Set();
        cityIds.add(cityId);
        this.store.exploreListingCities.set(listingId, cityIds);
      }
      return { rows: [] };
    }

    if (text.startsWith('delete from "explore_listing_cities"')) {
      this.store.exploreListingCities.delete(String(params[0]));
      return { rows: [] };
    }

    const status = String(params[0]);
    const counts = new Map<string, number>();
    for (const listing of this.store.exploreListings.values()) {
      if (listing.status !== status) continue;
      for (const cityId of this.store.exploreListingCities.get(listing.id) ?? []) {
        counts.set(cityId, (counts.get(cityId) ?? 0) + 1);
      }
    }
    const limit = Number(params[params.length - 1]);
    return {
      rows: [...counts.entries()]
        .sort(([cityA, countA], [cityB, countB]) =>
          countA !== countB ? countB - countA : cityA < cityB ? -1 : 1
        )
        .slice(0, limit)
        .map(([cityId, count]) => [cityId, count]),
    };
  }

  private executeSaves(
    text: string,
    params: readonly unknown[]
  ): { rows: unknown[][] } {
    if (text.includes("deduped_saves")) {
      return this.executeSavedList(text, params);
    }

    if (text.includes("count(distinct")) {
      const listingId = String(params[0]);
      const dateParams = params.filter((p) => p instanceof Date);
      const asOf = dateParams.length > 0 ? dateParams[1] : undefined;
      return { rows: [[saveCount(this.store, listingId, asOf?.toISOString())]] };
    }

    if (text.includes("max(")) {
      const listingId = String(params[params.length - 1]);
      const participantIds = params.slice(0, -1).map((p) => String(p));
      const cycles = this.store.exploreSaves
        .filter(
          (save) =>
            participantIds.includes(save.participantId) &&
            save.listingId === listingId
        )
        .map((save) => save.saveCycle ?? 1);
      return { rows: [[cycles.length ? Math.max(...cycles) : null]] };
    }

    if (text.includes("inner join")) {
      return this.executeSavedList(text, params);
    }

    // save state / active-save probe.
    if (text.startsWith("select")) {
      const limitStripped = params.slice(0, -1);
      const listingId = String(limitStripped[limitStripped.length - 1]);
      const participantIds = limitStripped.slice(0, -1).map((p) => String(p));
      const found = this.store.exploreSaves.some(
        (s) =>
          participantIds.includes(s.participantId) && s.listingId === listingId
          && isActiveSave(s)
      );
      return { rows: found ? [["x"]] : [] };
    }

    if (text.startsWith("insert")) {
      const [participantId, listingId, saveCycle, savedAt, unsavedAt] = params as [
        string,
        string,
        number,
        string,
        string | null,
      ];
      const exists = this.store.exploreSaves.some(
        (s) =>
          s.participantId === participantId &&
          s.listingId === listingId &&
          (s.saveCycle ?? 1) === saveCycle
      );
      if (!exists) {
        this.store.exploreSaves.push({
          participantId,
          listingId,
          saveCycle,
          savedAt: iso(savedAt),
          unsavedAt: unsavedAt == null ? null : iso(unsavedAt),
        });
      }
      return { rows: [] };
    }

    // unsave closes intervals; history rows are never deleted.
    if (text.startsWith("update")) {
      const listingId = String(params[params.length - 1]);
      const participantIds = params.slice(1, -1).map((p) => String(p));
      const unsavedAt = iso(params[0]);
      for (const save of this.store.exploreSaves) {
        if (
          participantIds.includes(save.participantId) &&
          save.listingId === listingId &&
          isActiveSave(save)
        ) {
          save.unsavedAt = unsavedAt;
        }
      }
      return { rows: [] };
    }

    throw new Error(`Unrecognized explore_plan_saves SQL: ${text}`);
  }

  private executeSavedList(
    _text: string,
    params: readonly unknown[]
  ): { rows: unknown[][] } {
    // params: [...participantIds, 'LISTED', (cursorSavedAt, cursorSavedAt,
    // cursorListingId)?, limit]
    const listedIdx = params.findIndex((p) => p === "LISTED");
    const participantIds = params.slice(0, listedIdx).map((p) => String(p));
    const rest = params.slice(listedIdx + 1);
    const limit = Number(rest[rest.length - 1]);
    let cursor: { savedAt: string; listingId: string } | undefined;
    if (rest.length >= 4) {
      cursor = { savedAt: String(rest[0]), listingId: String(rest[2]) };
    }

    const grouped = new Map<string, string>();
    for (const s of this.store.exploreSaves) {
      if (!participantIds.includes(s.participantId) || !isActiveSave(s)) continue;
      const existing = grouped.get(s.listingId);
      if (existing === undefined || s.savedAt < existing) {
        grouped.set(s.listingId, s.savedAt);
      }
    }

    let joined = [...grouped.entries()]
      .map(([listingId, savedAt]) => ({
        savedAt,
        listing: this.store.exploreListings.get(listingId),
      }))
      .filter(
        (e): e is { savedAt: string; listing: ExploreListingRecord } =>
          e.listing !== undefined && e.listing.status === "LISTED"
      );

    if (cursor) {
      const c = cursor;
      joined = joined.filter(
        (e) =>
          e.savedAt < c.savedAt ||
          (e.savedAt === c.savedAt && e.listing.id < c.listingId)
      );
    }

    joined.sort((a, b) =>
      a.savedAt !== b.savedAt
        ? a.savedAt < b.savedAt
          ? 1
          : -1
        : a.listing.id < b.listing.id
          ? 1
          : -1
    );

    // select order: saved_at, id, status, listing_revision, source_plan_revision,
    //   snapshot, listed_at, updated_at, unlisted_at
    const rows = joined.slice(0, limit).map((e) => [
      e.savedAt,
      e.listing.id,
      e.listing.status,
      e.listing.listingRevision,
      e.listing.sourcePlanRevision,
      e.listing.snapshot,
      e.listing.listedAt,
      e.listing.updatedAt,
      e.listing.unlistedAt,
      saveCount(this.store, e.listing.id),
    ]);
    return { rows };
  }
}

/**
 * transaction-aware stateful pg client.
 *
 * drizzle node-postgres session은 `begin`/`commit`/`rollback`을 같은 client에
 * 순차적으로 실행한다(우리 client는 Pool이 아니므로 connect/release 없음). 따라서
 * transaction 진입 시 store snapshot을 떠 두고, rollback 시 되돌린다.
 */
class StatefulClient {
  private snapshots: Store[] = [];
  private readonly store: Store;
  private readonly engine: QueryEngine;

  constructor(store: Store) {
    this.store = store;
    this.engine = new QueryEngine(store);
  }

  query = async (
    config: { readonly text: string } | string,
    params: readonly unknown[] = []
  ): Promise<{ rows: unknown[][] }> => {
    const text = typeof config === "string" ? config : config.text;
    const normalized = normalize(text).toLowerCase();

    if (normalized === "begin") {
      this.snapshots.push(cloneStore(this.store));
      return { rows: [] };
    }
    if (normalized === "commit") {
      this.snapshots.pop();
      return { rows: [] };
    }
    if (normalized === "rollback") {
      const snap = this.snapshots.pop();
      if (snap) restoreStore(this.store, snap);
      return { rows: [] };
    }

    return this.engine.execute(text, params);
  };
}

export interface SeedParticipant {
  readonly id: string;
  readonly name: string;
  readonly accountType?: "REGISTERED" | "GUEST";
  readonly aliases?: readonly string[];
}

export interface HarnessSeed {
  readonly participants: readonly SeedParticipant[];
  readonly tripRooms?: readonly TripRoomRecord[];
  readonly exploreListings?: readonly ExploreListingRecord[];
  readonly exploreSaves?: readonly ExploreSaveRecord[];
}

const HEADER = "x-test-session";
const BASE_URL = "https://galanda.test";

export interface JourneyHarness {
  readonly app: ReturnType<typeof createApp>;
  readonly requestAs: (
    participantId: string | null,
    path: string,
    init?: RequestInit
  ) => Promise<Response>;
  readonly store: Store;
}

export const createJourneyHarness = (seed: HarnessSeed): JourneyHarness => {
  const store: Store = {
    tripRooms: new Map(),
    exploreListings: new Map(),
    exploreListingCities: new Map(),
    exploreSaves: [],
    participantAliases: [],
    registeredParticipantIds: new Set(),
  };
  for (const room of seed.tripRooms ?? []) {
    store.tripRooms.set(room.id, { ...room });
  }
  for (const listing of seed.exploreListings ?? []) {
    store.exploreListings.set(listing.id, { ...listing });
    store.exploreListingCities.set(listing.id, new Set(listing.cityIds ?? []));
  }
  store.exploreSaves = (seed.exploreSaves ?? []).map((s) => ({ ...s }));
  for (const p of seed.participants) {
    if (p.accountType !== "GUEST") store.registeredParticipantIds.add(p.id);
    for (const alias of p.aliases ?? []) {
      store.participantAliases.push({
        aliasParticipantId: alias,
        canonicalParticipantId: p.id,
      });
    }
  }

  const participantsById = new Map(seed.participants.map((p) => [p.id, p]));

  const withDatabase: NonNullable<AppDependencies["withDatabase"]> = async (
    _env,
    run
  ) => {
    const client = new StatefulClient(store);
    const db = drizzle(client as unknown as NodePgClient, { schema });
    return run(db as DatabaseHandle);
  };

  const makeAuth = ((_db: unknown, _env: unknown) => ({
    handler: () => new Response(null, { status: 404 }),
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get(HEADER);
        if (!id) return null;
        const participant = participantsById.get(id);
        if (!participant) return null;
        return {
          user: {
            id: participant.id,
            name: participant.name,
            email: `${participant.id}@example.com`,
            isAnonymous: participant.accountType === "GUEST",
          },
        };
      },
    },
  })) as unknown as NonNullable<AppDependencies["makeAuth"]>;

  const resolveParticipantIdentity: NonNullable<
    AppDependencies["resolveParticipantIdentity"]
  > = async (_db, userId) => {
    const participant = participantsById.get(userId);
    const aliases = participant?.aliases ?? [];
    return {
      participantId: ParticipantIdSchema.make(userId),
      participantIds: [userId, ...aliases].map((id) =>
        ParticipantIdSchema.make(id)
      ),
    };
  };

  const app = createApp({ withDatabase, makeAuth, resolveParticipantIdentity });

  const requestAs = (
    participantId: string | null,
    path: string,
    init?: RequestInit
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("content-type", "application/json");
    if (participantId) headers.set(HEADER, participantId);
    return Promise.resolve(
      app.fetch(
        new Request(`${BASE_URL}${path}`, { ...init, headers }),
        {} as AppEnv["Bindings"]
      )
    );
  };

  return { app, requestAs, store };
};

/**
 * globalThis.fetch를 harness `app.fetch`로 라우팅한다(cross-surface React Query UI용).
 *
 * 실제 api-client는 상대 경로로 `fetch(path, init)`를 호출한다. 여기서 상대 경로를
 * 절대 URL로 바꾸고, 현재 세션 participant를 `x-test-session` header로 주입한다.
 * production 코드/컴포넌트/React Query 훅은 그대로 실제 API를 호출한다(별도
 * mock 없음). 반환된 `restore()`로 원래 fetch를 복구한다.
 */
export const routeFetchToApp = (
  harness: JourneyHarness,
  participantId: string | null
): { restore: () => void } => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = rawUrl.startsWith("http") ? rawUrl : `${BASE_URL}${rawUrl}`;
    const headers = new Headers(init?.headers);
    if (participantId) headers.set(HEADER, participantId);
    return await harness.app.fetch(
      new Request(url, { ...init, headers }),
      {} as AppEnv["Bindings"]
    );
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
};
