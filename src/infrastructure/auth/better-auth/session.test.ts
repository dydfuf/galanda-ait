import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { SessionService } from "../../../core/ports/session.ts";
import {
  SessionUnavailableError,
  UnauthorizedError,
} from "../../../core/domain/errors.ts";
import {
  normalizeBetterAuthSession,
  SessionServiceLive,
} from "./session.ts";

const currentSession = SessionService.pipe(
  Effect.flatMap((service) => service.getCurrentSession())
);

describe("Better Auth SessionService adapter", () => {
  it("normalizes an authenticated Better Auth session", async () => {
    const session = await Effect.runPromise(
      currentSession.pipe(
        Effect.provide(
          SessionServiceLive({
            user: { id: "user-better-auth", name: null, email: "user@example.com" },
          })
        )
      )
    );

    expect(session).toEqual({
      userId: "user-better-auth",
      name: "user@example.com",
      isAuthenticated: true,
    });
  });

  it("maps no session to UnauthorizedError", async () => {
    const error = await Effect.runPromise(
      Effect.flip(currentSession.pipe(Effect.provide(SessionServiceLive(null))))
    );

    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it("maps an auth lookup failure to SessionUnavailableError", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        currentSession.pipe(
          Effect.provide(SessionServiceLive(null, new Error("database down")))
        )
      )
    );

    expect(error).toBeInstanceOf(SessionUnavailableError);
    expect((error as SessionUnavailableError).reason).toContain("database down");
  });

  it("keeps normalization available as a provider-neutral boundary", () => {
    expect(
      normalizeBetterAuthSession({ user: { id: "user-1", name: "사용자" } })
    ).toEqual({
      userId: "user-1",
      name: "사용자",
      isAuthenticated: true,
    });
  });
});
