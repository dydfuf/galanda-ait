import { Effect, Layer } from "effect";
import { SessionService } from "../../core/ports/session.ts";
import { UserIdSchema } from "../../core/domain/ids.ts";
import { UnauthorizedError } from "../../core/domain/errors.ts";
import { supabase } from "./supabase-client.ts";
import type { UserSession } from "../../core/domain/room.ts";

const fetchSupabaseUser = (): Effect.Effect<UserSession, UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        throw new Error(error?.message ?? "로그인이 필요합니다.");
      }
      return {
        userId: UserIdSchema.make(data.session.user.id),
        name:
          data.session.user.user_metadata?.name ??
          data.session.user.email ??
          "사용자",
        isAuthenticated: true,
      };
    },
    catch: (e) =>
      new UnauthorizedError({
        reason: e instanceof Error ? e.message : "로그인이 필요합니다.",
      }),
  });

export const SupabaseSessionLayer = Layer.succeed(SessionService, {
  getCurrentSession: () => fetchSupabaseUser(),
  getCurrentUser: () => fetchSupabaseUser(),
});
