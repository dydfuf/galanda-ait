import { Context, Effect, Option } from "effect";
import type { UserSession } from "../domain/room.ts";
import { UnauthorizedError } from "../domain/errors.ts";

export class SessionService extends Context.Service<
  SessionService,
  {
    readonly getCurrentSession: () => Effect.Effect<
      UserSession,
      UnauthorizedError
    >;
  }
>()("galanda/ports/SessionService") { }

/**
 * 인증된 세션을 요구하는 Effect
 * - 미인증 또는 세션 오류 발생 시 지정된 이유의 UnauthorizedError로 실패
 */
export const requireAuthSession = (
  reason = "로그인이 필요합니다."
): Effect.Effect<UserSession, UnauthorizedError, SessionService> =>
  Effect.gen(function* () {
    const sessionService = yield* SessionService;
    const session = yield* sessionService.getCurrentSession().pipe(
      Effect.catch(() =>
        Effect.fail(new UnauthorizedError({ reason }))
      )
    );

    if (!session.isAuthenticated) {
      return yield* Effect.fail(new UnauthorizedError({ reason }));
    }

    return session;
  });

/**
 * 현재 세션을 Option 형태로 안전하게 획득하는 Effect (실패 시 None)
 */
export const getOptionalSession: Effect.Effect<
  Option.Option<UserSession>,
  never,
  SessionService
> = SessionService.pipe(
  Effect.flatMap((s) => s.getCurrentSession()),
  Effect.map((session) =>
    session.isAuthenticated ? Option.some(session) : Option.none()
  ),
  Effect.catch(() => Effect.succeed(Option.none()))
);
