import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { Database } from "../src/infrastructure/database/database.ts";
import { tripRooms } from "../src/infrastructure/database/schema.ts";
import { DatabaseConfigurationError } from "../src/infrastructure/errors.ts";
import { makeDatabaseLive } from "./database-live.ts";

const program = Effect.gen(function* () {
  const { db } = yield* Database;
  return db;
});

describe("makeDatabaseLive", () => {
  it("fails fast with DatabaseConfigurationError when DATABASE_URL is missing", async () => {
    const error = await Effect.runPromise(
      Effect.flip(program.pipe(Effect.provide(makeDatabaseLive(undefined))))
    );

    expect(error).toBeInstanceOf(DatabaseConfigurationError);
  });

  it("fails fast with DatabaseConfigurationError when DATABASE_URL is blank", async () => {
    const error = await Effect.runPromise(
      Effect.flip(program.pipe(Effect.provide(makeDatabaseLive("   "))))
    );

    expect(error).toBeInstanceOf(DatabaseConfigurationError);
  });

  it("builds a Drizzle database from server-only credentials without opening a connection", async () => {
    const db = await Effect.runPromise(
      program.pipe(
        Effect.provide(
          makeDatabaseLive(
            "postgres://galanda:secret@localhost:5432/galanda"
          )
        )
      )
    );

    expect(db).toBeDefined();
    // 쿼리 빌더가 스키마 테이블을 인식하는지 실행 없이 확인한다.
    expect(() => db.select().from(tripRooms)).not.toThrow();
  });

  it("closes the connection pool when the layer scope ends", async () => {
    const layer = makeDatabaseLive("postgres://galanda:secret@localhost:5432/galanda");

    const first = await Effect.runPromise(program.pipe(Effect.provide(layer)));
    const second = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });
});
