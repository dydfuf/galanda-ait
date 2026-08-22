import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { Database } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import { tripRooms } from "../../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { DatabaseConfigurationError } from "../../../src/infrastructure/errors.ts";
import { DatabaseLive } from "./database-live.ts";

const database = Effect.gen(function* () {
  return yield* Database;
});

describe("DatabaseLive", () => {
  it("requires a server-side database configuration", async () => {
    const error = await Effect.runPromise(
      Effect.flip(database.pipe(Effect.provide(DatabaseLive({}))))
    );

    expect(error).toBeInstanceOf(DatabaseConfigurationError);
  });

  it("builds the typed Drizzle handle without opening a connection", async () => {
    const service = await Effect.runPromise(
      database.pipe(
        Effect.provide(
          DatabaseLive({
            DATABASE_URL: "postgres://galanda:secret@localhost:5432/galanda",
          })
        )
      )
    );

    expect(() => service.db.select().from(tripRooms)).not.toThrow();
  });
});
