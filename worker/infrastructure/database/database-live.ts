import { Effect, Layer } from "effect";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Database } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { DatabaseConfigurationError } from "../../../src/infrastructure/errors.ts";

export interface DatabaseEnv {
  /** Cloudflare Hyperdrive binding; only available in the Worker runtime. */
  readonly HYPERDRIVE?: { readonly connectionString: string };
  /** Local/staging migration or secret fallback; never a VITE_* variable. */
  readonly DATABASE_URL?: string;
}

const getConnectionString = (env: DatabaseEnv): string | undefined =>
  env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

/** Creates the Worker database layer without exposing credentials to the Vite client. */
export const DatabaseLive = (
  env: DatabaseEnv
): Layer.Layer<Database, DatabaseConfigurationError> =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      const connectionString = getConnectionString(env);
      if (!connectionString?.trim()) {
        return yield* Effect.fail(
          new DatabaseConfigurationError({
            message: "Database configuration is missing: HYPERDRIVE or DATABASE_URL is required.",
          })
        );
      }

      // ponytail: one pool per request scope; move to isolate-scoped memoization when throughput requires it.
      const pool = new Pool({ connectionString, max: 1 });
      yield* Effect.addFinalizer(() => Effect.promise(() => pool.end()));

      return { db: drizzle(pool, { schema }) };
    })
  );
