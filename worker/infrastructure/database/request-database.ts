import { Context, Effect, Layer } from "effect";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../app.ts";
import {
  Database,
  type DatabaseHandle,
} from "../../../src/infrastructure/persistence/drizzle/database.ts";
import { DatabaseLive } from "./database-live.ts";

export const withDatabase = <A>(
  env: Parameters<typeof DatabaseLive>[0],
  use: (db: DatabaseHandle) => Promise<A>
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(DatabaseLive(env));
        return yield* Effect.tryPromise(() =>
          use(Context.get(context, Database).db)
        );
      })
    )
  );

export type WithDatabase = typeof withDatabase;

export const createRequestDatabaseMiddleware = (
  runWithDatabase: WithDatabase = withDatabase
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.req.path === "/api/health") {
      await next();
      return;
    }

    let downstreamStarted = false;
    try {
      await runWithDatabase(c.env, async (db) => {
        c.set("database", db);
        downstreamStarted = true;
        await next();
      });
    } catch (error) {
      if (downstreamStarted) {
        throw error;
      }
      c.set("databaseError", error);
      await next();
    }
  });

export const requestDatabaseMiddleware = createRequestDatabaseMiddleware();
