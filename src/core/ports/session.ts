import { Context, Effect, Option } from "effect";
import type { UserSession } from "../domain/room.ts";
import {
  AccountUpgradeRequiredError,
  UnauthorizedError,
} from "../domain/errors.ts";
import type { SessionUnavailableError } from "../domain/errors.ts";

/**
 * 세션 조회 시 발생할 수 있는 오류
 * - UnauthorizedError: 로그인하지 않은 상태 (정상적인 비로그인)
 * - SessionUnavailableError: 세션 저장소·인증 서버 장애로 현재 사용자를 판별할 수 없는 상태
 *
 * 두 오류를 구분해야 화면이 "로그인해주세요"와 "잠시 후 다시 시도해주세요"를 다르게 안내할 수 있다.
 */
export type SessionLookupError = UnauthorizedError | SessionUnavailableError;

export class SessionService extends Context.Service<
  SessionService,
  {
    readonly getCurrentSession: () => Effect.Effect<
      UserSession,
      SessionLookupError
    >;
    readonly getCurrentUser: () => Effect.Effect<
      UserSession,
      SessionLookupError
    >;
  }
>()("galanda/ports/SessionService") { }

/**
 * 인증된 세션을 요구하는 Effect
 * - 미인증 시 지정된 이유의 UnauthorizedError로 실패
 * - 세션 조회 자체가 실패한 경우에는 SessionUnavailableError를 그대로 전파해
 *   "로그인 필요"로 잘못 안내되지 않도록 한다
 */
export const requireAuthSession = (
  reason = "로그인이 필요합니다."
): Effect.Effect<UserSession, SessionLookupError, SessionService> =>
  Effect.gen(function* () {
    const sessionService = yield* SessionService;
    const session = yield* sessionService.getCurrentUser().pipe(
      Effect.catchTag("UnauthorizedError", () =>
        Effect.fail(new UnauthorizedError({ reason }))
      )
    );

    if (!session.isAuthenticated) {
      return yield* Effect.fail(new UnauthorizedError({ reason }));
    }

    return session;
  });

/**
 * 현재 인증된 사용자를 조회하는 Effect
 */
export const getCurrentUser = (
  reason = "로그인이 필요합니다."
): Effect.Effect<UserSession, SessionLookupError, SessionService> =>
  requireAuthSession(reason);

export const requireRegisteredSession = (
  reason = "계정 연결이 필요합니다."
) =>
  Effect.gen(function* () {
    const session = yield* requireAuthSession();
    if (session.accountType !== "REGISTERED") {
      return yield* Effect.fail(new AccountUpgradeRequiredError({ reason }));
    }
    return session;
  });

/**
 * 현재 세션을 Option 형태로 획득하는 Effect
 * - 비로그인 상태만 None으로 매핑한다
 * - 세션 조회 실패(SessionUnavailableError)는 삼키지 않고 호출자에게 전파해
 *   UI가 "비로그인"과 "조회 실패"를 구분할 수 있게 한다
 */
export const getOptionalSession: Effect.Effect<
  Option.Option<UserSession>,
  SessionUnavailableError,
  SessionService
> = SessionService.pipe(
  Effect.flatMap((s) => s.getCurrentSession()),
  Effect.map((session) =>
    session.isAuthenticated ? Option.some(session) : Option.none()
  ),
  Effect.catchTag("UnauthorizedError", () => Effect.succeed(Option.none()))
);
