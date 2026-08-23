import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import type { DatabaseHandle } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import { linkAnonymousParticipant } from "../../../src/infrastructure/auth/better-auth/participant-identity.ts";

const tossApiBaseUrl = "https://apps-in-toss-api.toss.im";

const tokenResponseSchema = z.object({
  resultType: z.literal("SUCCESS"),
  success: z.object({ accessToken: z.string().min(1) }),
});

const userResponseSchema = z.object({
  resultType: z.literal("SUCCESS"),
  success: z.object({ userKey: z.union([z.string(), z.number()]) }),
});

export interface TossLoginFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface TossLoginOptions {
  readonly db: DatabaseHandle;
  readonly fetcher?: TossLoginFetcher;
}

const requestTossUserKey = async (
  fetcher: TossLoginFetcher,
  authorizationCode: string,
  referrer: "DEFAULT" | "SANDBOX"
): Promise<string> => {
  const tokenResponse = await fetcher.fetch(
    `${tossApiBaseUrl}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authorizationCode, referrer }),
    }
  );
  const token = tokenResponseSchema.safeParse(await tokenResponse.json());
  if (!tokenResponse.ok || !token.success) {
    throw new APIError("UNAUTHORIZED", {
      code: "TOSS_TOKEN_EXCHANGE_FAILED",
      message: "토스 로그인 인증을 완료하지 못했습니다.",
    });
  }

  const userResponse = await fetcher.fetch(
    `${tossApiBaseUrl}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
    {
      headers: {
        authorization: `Bearer ${token.data.success.accessToken}`,
      },
    }
  );
  const user = userResponseSchema.safeParse(await userResponse.json());
  if (!userResponse.ok || !user.success) {
    throw new APIError("UNAUTHORIZED", {
      code: "TOSS_USER_LOOKUP_FAILED",
      message: "토스 사용자 정보를 확인하지 못했습니다.",
    });
  }
  return String(user.data.success.userKey);
};

export const tossLogin = ({ db, fetcher }: TossLoginOptions): BetterAuthPlugin => ({
  id: "toss-login",
  endpoints: {
    signInToss: createAuthEndpoint(
      "/sign-in/toss",
      {
        method: "POST",
        body: z
          .object({
            authorizationCode: z.string().min(1).max(2048),
            referrer: z.enum(["DEFAULT", "SANDBOX"]),
          })
          .strict(),
      },
      async (ctx) => {
        if (!fetcher) {
          throw new APIError("SERVICE_UNAVAILABLE", {
            code: "TOSS_LOGIN_NOT_CONFIGURED",
            message: "토스 로그인이 아직 설정되지 않았습니다.",
          });
        }

        const tossUserKey = await requestTossUserKey(
          fetcher,
          ctx.body.authorizationCode,
          ctx.body.referrer
        );
        const accountKey = { issuer: "toss", accountId: tossUserKey };
        const accountOwner = await ctx.context.internalAdapter.findAccountOwnerByKey(
          accountKey
        );
        if (accountOwner?.kind === "orphaned") {
          throw new APIError("CONFLICT", {
            code: "TOSS_ACCOUNT_ORPHANED",
            message: "토스 계정 연결 상태를 복구해야 합니다.",
          });
        }

        let registeredUser = accountOwner?.user;
        if (!registeredUser) {
          registeredUser = await ctx.context.internalAdapter.createUser(
            {
              name: "토스 사용자",
              email: `toss-${tossUserKey}@auth.galanda.invalid`,
              emailVerified: false,
            },
            {
              method: "oauth",
              oauth: { providerId: "toss", profile: { userKey: tossUserKey } },
            }
          );
          await ctx.context.internalAdapter.createAccount({
            ...accountKey,
            providerId: "toss",
            userId: registeredUser.id,
          });
        }

        const previousSession = await getSessionFromCtx(ctx, {
          disableRefresh: true,
        });
        if (
          previousSession?.user.isAnonymous &&
          previousSession.user.id !== registeredUser.id
        ) {
          await linkAnonymousParticipant(
            db,
            previousSession.user.id,
            registeredUser.id
          );
        }

        const session = await ctx.context.internalAdapter.createSession(
          registeredUser.id
        );
        await setSessionCookie(ctx, { session, user: registeredUser });

        if (
          previousSession?.user.isAnonymous &&
          previousSession.user.id !== registeredUser.id
        ) {
          await ctx.context.internalAdapter.deleteUser(previousSession.user.id);
        }

        return ctx.json({ success: true, user: { id: registeredUser.id } });
      }
    ),
  },
});
