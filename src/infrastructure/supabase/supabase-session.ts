import { Effect, Layer } from "effect";
import {
  SessionService,
  type SessionLookupError,
} from "../../core/ports/session.ts";
import { UserIdSchema } from "../../core/domain/ids.ts";
import {
  SessionUnavailableError,
  UnauthorizedError,
} from "../../core/domain/errors.ts";
import { SupabaseClient, type SupabaseJsClient } from "./supabase-client.ts";
import type { UserSession } from "../../core/domain/room.ts";

/**
 * Supabase 세션 조회
 * - 세션이 없으면 UnauthorizedError (비로그인)
 * - 조회 자체가 실패하면 SessionUnavailableError (네트워크·인증 서버 장애)
 */
export const fetchSupabaseUser = (
  client: SupabaseJsClient
): Effect.Effect<UserSession, SessionLookupError> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => client.auth.getSession(),
      catch: (e: unknown) =>
        new SessionUnavailableError({
          reason:
            e instanceof Error
              ? `로그인 정보를 확인하지 못했습니다: ${e.message}`
              : "로그인 정보를 확인하지 못했습니다.",
        }),
    });

    if (result.error) {
      return yield* Effect.fail(
        new SessionUnavailableError({
          reason: `로그인 정보를 확인하지 못했습니다: ${result.error.message}`,
        })
      );
    }

    const user = result.data.session?.user;
    if (!user) {
      return yield* Effect.fail(
        new UnauthorizedError({ reason: "로그인이 필요합니다." })
      );
    }

    const session: UserSession = {
      userId: UserIdSchema.make(user.id),
      name: user.user_metadata?.name ?? user.email ?? "사용자",
      isAuthenticated: true,
    };

    return session;
  });

export const SupabaseSessionLayer: Layer.Layer<
  SessionService,
  never,
  SupabaseClient
> = Layer.effect(
  SessionService,
  Effect.gen(function* () {
    const { client } = yield* SupabaseClient;

    return {
      getCurrentSession: () => fetchSupabaseUser(client),
      getCurrentUser: () => fetchSupabaseUser(client),
    };
  })
);
