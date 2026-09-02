import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
} from "../../../core/domain/errors.ts";
import {
  RevisionSchema,
  PlanIdSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { TripRoomRepository } from "../../../core/ports/trip-room-repository.ts";
import { Database } from "./database.ts";
import * as schema from "./schema/index.ts";
import { TripRoomRepositoryLive } from "./trip-room-repository.ts";

describe("TripRoomRepositoryLive", () => {
  it("participant alias 중 하나가 members에 포함된 방만 조회한다", async () => {
    const guestId = UserIdSchema.make("guest-1");
    const registeredId = UserIdSchema.make("registered-1");
    const room: TripRoom = {
      id: TripIdSchema.make("room-member"),
      title: "제주 여행",
      destination: "제주",
      revision: RevisionSchema.make(1),
      members: [{ id: guestId, name: "용열", role: "MEMBER" }],
      plans: [],
      confirmedPlanId: undefined,
    };
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        calls.push({ text: config.text, params });
        return {
          rows: config.text.includes('from "participant_alias"')
            ? []
            : [[
                room.id,
                room.title,
                room.destination,
                room.revision,
                room.members,
                room.plans,
                null,
                "2026-08-23T00:00:00.000Z",
                "2026-08-23T00:00:00.000Z",
              ]],
        };
      },
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TripRoomRepository;
        return yield* repository.getRooms([registeredId, guestId]);
      }).pipe(
        Effect.provide(
          TripRoomRepositoryLive.pipe(
            Layer.provide(Layer.succeed(Database, { db }))
          )
        )
      )
    );

    expect(result).toEqual([room]);
    expect(calls[0].text).toContain('"trip_rooms"."members" @>');
    expect(calls[0].text).toContain(" or ");
    expect(calls[0].params).toEqual([
      JSON.stringify([{ id: registeredId }]),
      JSON.stringify([{ id: guestId }]),
    ]);
  });

  it("resolves participant aliases before exposing a room", async () => {
    const guestId = UserIdSchema.make("guest-1");
    const registeredId = UserIdSchema.make("registered-1");
    const room: TripRoom = {
      id: TripIdSchema.make("room-alias"),
      title: "제주 여행",
      destination: "제주",
      revision: RevisionSchema.make(1),
      members: [
        { id: guestId, name: "용열", role: "MEMBER" },
        { id: registeredId, name: "계정 이름", role: "HOST" },
      ],
      plans: [
        {
          id: PlanIdSchema.make("plan-1"),
          title: "기본안",
          status: "DRAFT",
          authorId: registeredId,
          authorName: "계정 이름",
          places: [],
          memberOpinions: [
            { userId: registeredId, userName: "계정 이름", reaction: "LIKE" },
            { userId: guestId, userName: "용열", reaction: "HARD", reason: "멀어요" },
          ],
          voteCount: 1,
        },
      ],
      confirmedPlanId: undefined,
    };
    const client = {
      query: async (config: { readonly text: string }) => ({
        rows: config.text.includes('from "participant_alias"')
          ? [[registeredId, guestId]]
          : [[
              room.id,
              room.title,
              room.destination,
              room.revision,
              room.members,
              room.plans,
              null,
              "2026-08-23T00:00:00.000Z",
              "2026-08-23T00:00:00.000Z",
            ]],
      }),
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TripRoomRepository;
        return yield* repository.getRoom(room.id);
      }).pipe(
        Effect.provide(
          TripRoomRepositoryLive.pipe(
            Layer.provide(Layer.succeed(Database, { db }))
          )
        )
      )
    );

    expect(result.members).toEqual([
      { id: guestId, name: "용열", role: "HOST" },
    ]);
    expect(result.plans[0]).toMatchObject({
      authorId: guestId,
      authorName: "용열",
      voteCount: 0,
      memberOpinions: [
        { userId: guestId, userName: "용열", reaction: "HARD", reason: "멀어요" },
      ],
    });
  });

  it("initialPlan을 단일 INSERT로 room+plan을 한 aggregate row에 저장한다 (RAON-261 DISC-7)", async () => {
    const roomId = TripIdSchema.make("room-import");
    const hostId = UserIdSchema.make("host-import");
    const initialPlan = {
      id: PlanIdSchema.make("plan-imported-1"),
      title: "가져온 여행안",
      status: "VOTING" as const,
      revision: RevisionSchema.make(1),
      publishedAt: "2026-08-30T00:00:00.000Z",
      authorId: hostId,
      authorName: "Host",
      baseHeadcount: 1,
      routes: [
        { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
      ],
      accommodations: [
        {
          id: "acc-1",
          city: "오사카",
          period: "2026-09-01 ~ 2026-09-04",
          nights: 3,
          hotelName: "",
          isSearching: true,
          bookingStatus: "NOT_CHECKED" as const,
        },
      ],
      transports: [],
      places: [],
      memberOpinions: [],
      voteCount: 0,
    };
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        if (config.text.includes('from "participant_alias"')) return { rows: [] };
        calls.push({ text: config.text, params });
        // insert ... returning 이 방 row를 돌려주면 createRoom이 성공한다.
        return {
          rows: [
            [
              roomId,
              "가져온 여행",
              "오사카",
              1,
              [{ id: hostId, name: "Host", role: "HOST" }],
              [initialPlan],
              null,
              "2026-08-30T00:00:00.000Z",
              "2026-08-30T00:00:00.000Z",
            ],
          ],
        };
      },
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });
    const created = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TripRoomRepository;
        return yield* repository.createRoom({
          id: roomId,
          title: "가져온 여행",
          destination: "오사카",
          hostUser: { id: hostId, name: "Host", role: "HOST" },
          initialPlan,
          initialPlanActivity: {
            actorParticipantId: hostId,
            actorDisplayName: "Host",
            event: {
              type: "PLAN_CREATED",
              subjectPlanId: initialPlan.id,
              subjectTitle: initialPlan.title,
              roomRevision: 1,
              itineraryRevision: null,
            },
          },
        });
      }).pipe(
        Effect.provide(
          TripRoomRepositoryLive.pipe(
            Layer.provide(Layer.succeed(Database, { db }))
          )
        )
      )
    );

    // 단일 room INSERT 및 activity INSERT가 발생하고 후속 UPDATE(plan 추가)는 없다(partial write 없음).
    const inserts = calls.filter((c) => c.text.startsWith("insert"));
    expect(inserts).toHaveLength(2);
    expect(inserts[0].text).toContain('"trip_rooms"');
    expect(inserts[1].text).toContain('"trip_activity_events"');
    // room+plan이 한 aggregate row로 저장된다.
    expect(created.plans).toHaveLength(1);
    expect(created.plans[0]!.id).toBe("plan-imported-1");
    // insert params의 plans jsonb에 initialPlan이 포함된다.
    expect(JSON.stringify(inserts[0].params)).toContain("plan-imported-1");
  });

  it("initialPlan이 없으면 빈 방을 만든다 (기존 동작 유지)", async () => {
    const roomId = TripIdSchema.make("room-empty");
    const hostId = UserIdSchema.make("host-empty");
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        if (config.text.includes('from "participant_alias"')) return { rows: [] };
        calls.push({ text: config.text, params });
        return {
          rows: [
            [
              roomId,
              "빈 여행",
              "여행지",
              1,
              [{ id: hostId, name: "Host", role: "HOST" }],
              [],
              null,
              "2026-08-30T00:00:00.000Z",
              "2026-08-30T00:00:00.000Z",
            ],
          ],
        };
      },
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });
    const created = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TripRoomRepository;
        return yield* repository.createRoom({
          id: roomId,
          title: "빈 여행",
          hostUser: { id: hostId, name: "Host", role: "HOST" },
        });
      }).pipe(
        Effect.provide(
          TripRoomRepositoryLive.pipe(
            Layer.provide(Layer.succeed(Database, { db }))
          )
        )
      )
    );
    expect(created.plans).toEqual([]);
  });

  it("server-generated room ID collision을 domain state conflict로 노출하지 않는다", async () => {
    const roomId = TripIdSchema.make("room-collision");
    const client = {
      query: async (config: { readonly text: string }) => ({
        rows: config.text.startsWith("insert") ? [] : [[1]],
      }),
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });
    const collision = await Effect.runPromise(
      Effect.flip(
        Effect.gen(function* () {
          const repository = yield* TripRoomRepository;
          return yield* repository.createRoom({
            id: roomId,
            title: "충돌 여행",
            hostUser: {
              id: UserIdSchema.make("host-1"),
              name: "Host",
              role: "HOST",
            },
          });
        }).pipe(
          Effect.provide(
            TripRoomRepositoryLive.pipe(
              Layer.provide(Layer.succeed(Database, { db }))
            )
          )
        )
      )
    );

    expect(collision).toBeInstanceOf(RepositoryError);
    expect(collision).toMatchObject({ operation: "createRoom" });
  });

  it("revision 조건을 포함한 단일 UPDATE로 CAS하고 stale 쓰기를 RevisionConflictError로 거부한다", async () => {
    const room: TripRoom = {
      id: TripIdSchema.make("room-1"),
      title: "오사카 여행",
      destination: "오사카",
      revision: RevisionSchema.make(3),
      members: [
        {
          id: UserIdSchema.make("host-1"),
          name: "Host",
          role: "HOST",
        },
      ],
      plans: [],
      confirmedPlanId: undefined,
    };
    const responses: Array<Array<Array<unknown>>> = [
      [
        [
          room.id,
          room.title,
          room.destination,
          4,
          room.members,
          room.plans,
          null,
          "2026-08-23T00:00:00.000Z",
          "2026-08-23T00:00:00.000Z",
        ],
      ],
      [],
      [[4]],
    ];
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        if (config.text.includes('from "participant_alias"')) return { rows: [] };
        calls.push({ text: config.text, params });
        return { rows: responses.shift() ?? [] };
      },
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });
    const RepositoryTest = TripRoomRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    );
    const save = (expectedRevision: number) =>
      Effect.gen(function* () {
        const repository = yield* TripRoomRepository;
        return yield* repository.saveRoom(
          room,
          RevisionSchema.make(expectedRevision)
        );
      }).pipe(Effect.provide(RepositoryTest));

    const saved = await Effect.runPromise(save(3));
    const conflict = await Effect.runPromise(Effect.flip(save(3)));

    expect(saved.revision).toBe(4);
    expect(conflict).toBeInstanceOf(RevisionConflictError);
    expect(conflict).toMatchObject({ expectedRevision: 3, actualRevision: 4 });
    expect(calls[0].text).toContain('update "trip_rooms"');
    expect(calls[0].text).toContain('"revision" = "trip_rooms"."revision" + 1');
    expect(calls[0].text).toContain(
      'where ("trip_rooms"."id" = $6 and "trip_rooms"."revision" = $7)'
    );
    expect(calls[0].params).toEqual([
      room.title,
      room.destination,
      JSON.stringify(room.members),
      JSON.stringify(room.plans),
      null,
      room.id,
      3,
    ]);
  });
});

describe("TripRoomRepositoryLive.deletePlanAndAutoUnlist", () => {
  const hostId = UserIdSchema.make("host-1");
  const roomId = TripIdSchema.make("room-1");
  const sourcePlanId = PlanIdSchema.make("plan-listed");
  const unlistedAt = "2026-08-30T00:00:00.000Z";

  // plan이 이미 제거된 목표 room 상태.
  const roomAfterDelete: TripRoom = {
    id: roomId,
    title: "오사카 여행",
    destination: "오사카",
    revision: RevisionSchema.make(3),
    members: [{ id: hostId, name: "Host", role: "HOST" }],
    plans: [],
    confirmedPlanId: undefined,
  };

  const roomRow = (revision: number): Array<unknown> => [
    roomId,
    roomAfterDelete.title,
    roomAfterDelete.destination,
    revision,
    roomAfterDelete.members,
    roomAfterDelete.plans,
    null,
    "2026-08-23T00:00:00.000Z",
    "2026-08-23T00:00:00.000Z",
  ];

  const runDelete = (
    client: {
      query: (
        config: { readonly text: string },
        params?: unknown[]
      ) => Promise<{ rows: Array<Array<unknown>> }>;
    },
    expectedRevision: number
  ) => {
    const db = drizzle(client as unknown as NodePgClient, { schema });
    return Effect.gen(function* () {
      const repository = yield* TripRoomRepository;
      return yield* repository.deletePlanAndAutoUnlist({
        room: roomAfterDelete,
        sourcePlanId,
        expectedRevision: RevisionSchema.make(expectedRevision),
        unlistedAt,
        activity: {
          actorParticipantId: hostId,
          actorDisplayName: "Host",
          event: {
            type: "PLAN_DELETED",
            subjectPlanId: sourcePlanId,
            subjectTitle: "First Plan",
            roomRevision: roomAfterDelete.revision,
            itineraryRevision: null,
          },
        },
      });
    }).pipe(
      Effect.provide(
        TripRoomRepositoryLive.pipe(
          Layer.provide(Layer.succeed(Database, { db }))
        )
      )
    );
  };

  it("room CAS 성공 시 같은 transaction에서 매칭 LISTED listing을 UNLISTED로 전이하고 listing_revision을 +1, updated_at/unlisted_at을 서버 시각으로 갱신하되 listed_at/snapshot/source revision은 보존한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    let began = false;
    let committed = false;
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        const text = config.text;
        if (text.includes('from "participant_alias"')) return { rows: [] };
        if (/^begin/i.test(text)) {
          began = true;
          return { rows: [] };
        }
        if (/^commit/i.test(text)) {
          committed = true;
          return { rows: [] };
        }
        if (/^rollback/i.test(text)) return { rows: [] };
        calls.push({ text, params });
        // room UPDATE ... returning → CAS 성공 row.
        if (text.startsWith("update") && text.includes('"trip_rooms"')) {
          return { rows: [roomRow(4)] };
        }
        // listing UPDATE (no returning) → 매칭 1건 갱신.
        if (text.startsWith("update") && text.includes('"explore_plan_listings"')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    const saved = await Effect.runPromise(runDelete(client, 3));

    expect(saved.revision).toBe(4);
    expect(saved.plans).toEqual([]);
    // 두 write가 하나의 transaction 안에서 일어난다.
    expect(began).toBe(true);
    expect(committed).toBe(true);

    const roomUpdate = calls.find(
      (c) => c.text.startsWith("update") && c.text.includes('"trip_rooms"')
    );
    const listingUpdate = calls.find(
      (c) => c.text.startsWith("update") && c.text.includes('"explore_plan_listings"')
    );
    expect(roomUpdate).toBeDefined();
    expect(listingUpdate).toBeDefined();

    // room은 revision 조건부 CAS.
    expect(roomUpdate!.text).toContain(
      '"revision" = "trip_rooms"."revision" + 1'
    );
    expect(roomUpdate!.text).toContain('"trip_rooms"."revision" =');

    // listing은 (source_trip_id, source_plan_id, status=LISTED) 매칭 + atomic +1.
    expect(listingUpdate!.text).toContain('update "explore_plan_listings"');
    expect(listingUpdate!.text).toContain(
      '"listing_revision" = "explore_plan_listings"."listing_revision" + 1'
    );
    expect(listingUpdate!.text).toContain('"source_trip_id" =');
    expect(listingUpdate!.text).toContain('"source_plan_id" =');
    expect(listingUpdate!.text).toContain('"status" =');
    // 서버 unlistedAt이 updated_at/unlisted_at으로 전달된다.
    expect(listingUpdate!.params).toContain("UNLISTED");
    // status 매칭 필터로 LISTED만 대상. listed_at/snapshot/source revision은 SET에 없다.
    expect(listingUpdate!.params).toContain("LISTED");
    expect(listingUpdate!.text).not.toContain('"listed_at" =');
    expect(listingUpdate!.text).not.toContain('"snapshot" =');
    expect(listingUpdate!.text).not.toContain('"source_plan_revision" =');
  });

  it("room CAS가 stale(miss)이면 listing을 건드리지 않고 RevisionConflictError를 반환한다", async () => {
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        const text = config.text;
        if (text.includes('from "participant_alias"')) return { rows: [] };
        if (/^(begin|commit|rollback)/i.test(text)) return { rows: [] };
        calls.push({ text, params });
        if (text.startsWith("update") && text.includes('"trip_rooms"')) {
          return { rows: [] }; // CAS miss
        }
        if (text.startsWith("select") && text.includes('"trip_rooms"')) {
          return { rows: [[4]] }; // 현재 revision
        }
        return { rows: [] };
      },
    };

    const conflict = await Effect.runPromise(Effect.flip(runDelete(client, 3)));

    expect(conflict).toBeInstanceOf(RevisionConflictError);
    expect(conflict).toMatchObject({ expectedRevision: 3, actualRevision: 4 });
    // listing UPDATE는 발생하지 않는다(auto-unlist 없음).
    expect(
      calls.some(
        (c) => c.text.startsWith("update") && c.text.includes('"explore_plan_listings"')
      )
    ).toBe(false);
  });

  it("room CAS가 miss이고 room이 아예 없으면 NotFoundError를 반환한다", async () => {
    const client = {
      query: async (config: { readonly text: string }) => {
        const text = config.text;
        if (text.includes('from "participant_alias"')) return { rows: [] };
        if (/^(begin|commit|rollback)/i.test(text)) return { rows: [] };
        if (text.startsWith("update") && text.includes('"trip_rooms"')) {
          return { rows: [] }; // CAS miss
        }
        if (text.startsWith("select") && text.includes('"trip_rooms"')) {
          return { rows: [] }; // room 없음
        }
        return { rows: [] };
      },
    };

    const failure = await Effect.runPromise(Effect.flip(runDelete(client, 3)));
    expect(failure).toBeInstanceOf(NotFoundError);
    expect(failure).toMatchObject({ entity: "TripRoom", id: roomId });
  });

  it("매칭 LISTED listing이 없거나 이미 UNLISTED여도(0건 갱신) plan 삭제는 멱등하게 성공한다", async () => {
    const client = {
      query: async (config: { readonly text: string }) => {
        const text = config.text;
        if (text.includes('from "participant_alias"')) return { rows: [] };
        if (/^(begin|commit|rollback)/i.test(text)) return { rows: [] };
        if (text.startsWith("update") && text.includes('"trip_rooms"')) {
          return { rows: [roomRow(4)] }; // CAS 성공
        }
        if (text.startsWith("update") && text.includes('"explore_plan_listings"')) {
          return { rows: [] }; // 0건 갱신(매칭 없음/이미 UNLISTED)
        }
        return { rows: [] };
      },
    };

    const saved = await Effect.runPromise(runDelete(client, 3));
    expect(saved.revision).toBe(4);
    expect(saved.plans).toEqual([]);
  });

  it("어느 write가 실패하든 transaction이 rollback되고 RepositoryError로 전파된다", async () => {
    const client = {
      query: async (config: { readonly text: string }) => {
        const text = config.text;
        if (text.includes('from "participant_alias"')) return { rows: [] };
        if (/^(begin|commit|rollback)/i.test(text)) return { rows: [] };
        if (text.startsWith("update") && text.includes('"trip_rooms"')) {
          return { rows: [roomRow(4)] };
        }
        if (text.startsWith("update") && text.includes('"explore_plan_listings"')) {
          throw new Error("listing update failed");
        }
        return { rows: [] };
      },
    };

    const failure = await Effect.runPromise(Effect.flip(runDelete(client, 3)));
    expect(failure).toBeInstanceOf(RepositoryError);
    expect(failure).toMatchObject({ operation: "deletePlanAndAutoUnlist" });
  });
});
