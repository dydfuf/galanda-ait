import { Context, Effect, Layer } from "effect";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Database } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { DatabaseLive, type DatabaseEnv } from "../database/database-live.ts";

export interface BetterAuthEnv extends DatabaseEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
}

export type BetterAuth = ReturnType<typeof makeBetterAuth>;

export const makeBetterAuth = (
  db: NodePgDatabase<typeof schema>,
  env: BetterAuthEnv
) => {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    secret,
    ...(env.BETTER_AUTH_URL
      ? {
          baseURL: env.BETTER_AUTH_URL,
          trustedOrigins: [env.BETTER_AUTH_URL],
        }
      : {}),
    emailAndPassword: { enabled: true },
  });
};

export const withBetterAuth = <A>(
  env: BetterAuthEnv,
  use: (auth: ReturnType<typeof makeBetterAuth>) => Promise<A>
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(DatabaseLive(env));
        const { db } = Context.get(context, Database);
        return yield* Effect.tryPromise(() => use(makeBetterAuth(db, env)));
      })
    )
  );
