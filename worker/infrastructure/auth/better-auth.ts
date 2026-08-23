import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins";
import type { DatabaseHandle } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { linkAnonymousParticipant } from "../../../src/infrastructure/auth/better-auth/participant-identity.ts";
import type { DatabaseEnv } from "../database/database-live.ts";
import { tossLogin, type TossLoginFetcher } from "./toss-login.ts";

export interface BetterAuthEnv extends DatabaseEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly KAKAO_CLIENT_ID?: string;
  readonly KAKAO_CLIENT_SECRET?: string;
  readonly TOSS_MTLS?: TossLoginFetcher;
}

export type BetterAuth = ReturnType<typeof makeBetterAuth>;

export const makeBetterAuth = (
  db: DatabaseHandle,
  env: BetterAuthEnv
) => {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  const kakaoClientId = env.KAKAO_CLIENT_ID?.trim();

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
    emailAndPassword: { enabled: false },
    ...(kakaoClientId
      ? {
          socialProviders: {
            kakao: {
              clientId: kakaoClientId,
              clientSecret: env.KAKAO_CLIENT_SECRET?.trim(),
              disableDefaultScope: true,
              mapProfileToUser: (profile: { readonly id: number }) => ({
                email: `kakao-${profile.id}@auth.galanda.invalid`,
                name: "카카오 사용자",
              }),
            },
          },
        }
      : {}),
    plugins: [
      anonymous({
        onLinkAccount: ({ anonymousUser, newUser }) =>
          linkAnonymousParticipant(
            db,
            anonymousUser.user.id,
            newUser.user.id
          ),
      }),
      tossLogin({ db, fetcher: env.TOSS_MTLS }),
    ],
  });
};
