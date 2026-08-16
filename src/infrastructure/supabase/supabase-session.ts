import { Effect, Layer } from "effect";
import { SessionService } from "../../core/ports/session.ts";
import { UserIdSchema } from "../../core/domain/ids.ts";
import { UnauthorizedError } from "../../core/domain/errors.ts";
import { supabase } from "./supabase-client.ts";

export const SupabaseSessionLayer = Layer.succeed(SessionService, {
  getCurrentSession: () =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          throw new Error("No active session");
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
          reason: e instanceof Error ? e.message : "인증 실패",
        }),
    }),
});
