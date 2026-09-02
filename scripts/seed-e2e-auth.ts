import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { makeSignature } from "better-auth/crypto";
import { makeBetterAuth } from "../worker/infrastructure/auth/better-auth.ts";
import * as schema from "../src/infrastructure/persistence/drizzle/schema/index.ts";

const databaseURL = process.env.DATABASE_URL?.trim();
const secret = process.env.BETTER_AUTH_SECRET?.trim();
const outputPath = process.env.PLAYWRIGHT_AUTH_SEED_FILE?.trim();

if (!databaseURL || !secret || !outputPath) {
  throw new Error(
    "DATABASE_URL, BETTER_AUTH_SECRET, and PLAYWRIGHT_AUTH_SEED_FILE are required."
  );
}

const users = [
  {
    key: "host" as const,
    id: `e2e-host-${randomUUID()}`,
    name: "Host Alice",
    email: "qa-host@galanda.test",
  },
  {
    key: "member" as const,
    id: `e2e-member-${randomUUID()}`,
    name: "Member Bob",
    email: "qa-member@galanda.test",
  },
];

const pool = new Pool({ connectionString: databaseURL, max: 1 });

try {
  const db = drizzle(pool, { schema });
  const auth = makeBetterAuth(db, {
    DATABASE_URL: databaseURL,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  });
  const authContext = await auth.$context;

  const sessions = Object.fromEntries(
    await Promise.all(
      users.map(async (user) => {
        const previousUser = await authContext.internalAdapter.findUserByEmail(
          user.email
        );
        if (previousUser) {
          await authContext.internalAdapter.deleteUser(previousUser.user.id);
        }
        await authContext.internalAdapter.createUser({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: true,
        });
        const session = await authContext.internalAdapter.createSession(user.id);
        const signedValue = `${session.token}.${await makeSignature(
          session.token,
          secret
        )}`;

        return [
          user.key,
          {
            id: user.id,
            name: user.name,
            email: user.email,
            cookie: {
              name: authContext.authCookies.sessionToken.name,
              value: signedValue,
            },
          },
        ] as const;
      })
    )
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(sessions)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(`Seeded ${users.length} Better Auth E2E sessions.`);
} finally {
  await pool.end();
}
