import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../core/domain/errors.ts";
import {
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import { TripRoomRepository } from "../../../core/ports/trip-room-repository.ts";
import { Database } from "./database.ts";
import * as schema from "./schema/index.ts";
import { TripRoomRepositoryLive } from "./trip-room-repository.ts";

describe("TripRoomRepositoryLive", () => {
  it("revision 조건을 포함한 단일 UPDATE로 CAS하고 stale 쓰기를 ConflictError로 거부한다", async () => {
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
    expect(conflict).toBeInstanceOf(ConflictError);
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
