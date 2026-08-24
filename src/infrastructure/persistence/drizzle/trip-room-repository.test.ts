import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
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
