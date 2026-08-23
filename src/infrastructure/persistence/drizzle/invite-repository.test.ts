import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  InviteTokenSchema,
  ParticipantIdSchema,
  TripIdSchema,
} from "../../../core/domain/ids.ts";
import { InviteRepository } from "../../../core/ports/invite-repository.ts";
import { Database } from "./database.ts";
import { InviteRepositoryLive } from "./invite-repository.ts";
import * as schema from "./schema/index.ts";

describe("InviteRepositoryLive", () => {
  it("원문 token을 저장하지 않고 Trip 단위 atomic 재발급·조회·폐기한다", async () => {
    const tripId = TripIdSchema.make("trip-1");
    const participantId = ParticipantIdSchema.make("host-1");
    const token = InviteTokenSchema.make("00000000-0000-4000-8000-000000000001");
    const expiresAt = "2026-09-01T00:00:00.000Z";
    const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
    const client = {
      query: async (
        config: { readonly text: string },
        params: unknown[] = []
      ) => {
        calls.push({ text: config.text, params });
        if (config.text.startsWith("insert")) {
          return { rows: [] };
        }
        if (config.text.startsWith("select")) {
          return { rows: [[tripId, "Host"]] };
        }
        return { rows: [] };
      },
    };
    const db = drizzle(client as unknown as NodePgClient, { schema });
    const RepositoryTest = InviteRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* InviteRepository;
        yield* repository.issue({
          tripId,
          token,
          issuedByParticipantId: participantId,
          inviterName: "Host",
          expiresAt,
        });
        const found = yield* repository.findValid(
          token,
          new Date("2026-08-25T00:00:00.000Z")
        );
        yield* repository.revoke(tripId);
        return found;
      }).pipe(Effect.provide(RepositoryTest))
    );

    expect(result).toEqual({ tripId, inviterName: "Host" });
    expect(calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "insert",
      "select",
      "update",
    ]);
    expect(calls[0].text).toContain("on conflict (\"trip_id\") do update");
    expect(calls[0].text).toContain("\"revoked_at\" = $10");
    expect(calls[1].text).toContain('"revoked_at" is null');
    expect(calls[1].text).toContain('"expires_at" >');
    expect(JSON.stringify(calls)).not.toContain(token);

    const hash = calls[0].params.find(
      (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
    );
    expect(hash).toBeDefined();
    expect(calls[1].params).toContain(hash);
  });
});
