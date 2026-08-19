import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { SessionService } from "../../core/ports/session.ts";
import { TripRoomRepository } from "../../core/ports/trip-room-repository.ts";
import {
  SupabaseConfig,
  resolveDataBackend,
} from "../config/app-config.ts";
import {
  SupabaseClient,
  SupabaseClientLayer,
} from "../supabase/supabase-client.ts";
import { SupabaseSessionLayer } from "../supabase/supabase-session.ts";
import { SupabaseTripRoomRepositoryLayer } from "../supabase/supabase-trip-room-repo.ts";
import { LocalProfile } from "../../app/app-layer.ts";
import {
  InvalidDataBackendError,
  SupabaseConfigurationError,
} from "../errors.ts";
import { createTripRoomUseCase } from "../../core/usecases/create-room.ts";

describe("Infrastructure Layer Wiring & Config", () => {
  describe("Backend Selection (resolveDataBackend)", () => {
    it("returns 'local' when backend is 'local'", () => {
      expect(resolveDataBackend("local")).toBe("local");
    });

    it("returns 'supabase' when backend is 'supabase'", () => {
      expect(resolveDataBackend("supabase")).toBe("supabase");
    });

    it("throws InvalidDataBackendError for unknown backend string", () => {
      expect(() => resolveDataBackend("invalid-backend")).toThrow(
        InvalidDataBackendError
      );
    });

    it("falls back to 'supabase' when VITE_USE_SUPABASE is 'true'", () => {
      expect(resolveDataBackend(undefined, "true")).toBe("supabase");
    });

    it("defaults to 'local' in dev/test when neither is set or VITE_USE_SUPABASE is 'false'", () => {
      expect(resolveDataBackend(undefined, "false")).toBe("local");
      expect(resolveDataBackend(undefined, undefined)).toBe("local");
      expect(resolveDataBackend("", "")).toBe("local");
    });

    it("prioritizes VITE_DATA_BACKEND over VITE_USE_SUPABASE", () => {
      expect(resolveDataBackend("local", "true")).toBe("local");
      expect(resolveDataBackend("supabase", "false")).toBe("supabase");
    });

    it("selects 'supabase' when Supabase env variables are present even if VITE_DATA_BACKEND is missing", () => {
      expect(
        resolveDataBackend({
          supabaseUrl: "https://example.supabase.co",
        })
      ).toBe("supabase");

      expect(
        resolveDataBackend({
          supabaseAnonKey: "some-key",
        })
      ).toBe("supabase");
    });

    it("selects 'supabase' in production mode to avoid silent LocalProfile fallback", () => {
      expect(
        resolveDataBackend({
          isProd: true,
        })
      ).toBe("supabase");
    });

    it("still allows explicit 'local' backend in production mode if explicitly requested", () => {
      expect(
        resolveDataBackend({
          rawBackend: "local",
          isProd: true,
        })
      ).toBe("local");
    });
  });

  describe("LocalProfile", () => {
    const originalWindow = (globalThis as any).window;

    beforeEach(() => {
      const store: Record<string, string> = {};
      (globalThis as any).window = {
        localStorage: {
          getItem: (key: string) => store[key] ?? null,
          setItem: (key: string, val: string) => {
            store[key] = val;
          },
          removeItem: (key: string) => {
            delete store[key];
          },
          clear: () => {
            Object.keys(store).forEach((k) => delete store[k]);
          },
        },
      };
    });

    afterEach(() => {
      (globalThis as any).window = originalWindow;
    });

    it("builds and provides SessionService & TripRoomRepository without any Supabase env/config", async () => {
      const program = Effect.gen(function* () {
        const sessionService = yield* SessionService;
        const tripRoomRepo = yield* TripRoomRepository;

        expect(sessionService).toBeDefined();
        expect(tripRoomRepo).toBeDefined();

        const session = yield* sessionService.getCurrentSession();
        expect(session.isAuthenticated).toBe(true);

        const rooms = yield* tripRoomRepo.getRooms();
        expect(Array.isArray(rooms)).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LocalProfile)));
    });

    it("allows running usecases with LocalProfile", async () => {
      const program = createTripRoomUseCase({
        title: "제주도 여행",
        destination: "제주",
        startDate: "2026-09-01",
        endDate: "2026-09-05",
      });

      const room = await Effect.runPromise(
        program.pipe(Effect.provide(LocalProfile))
      );

      expect(room.title).toBe("제주도 여행");
      expect(room.destination).toBe("제주");
      expect(room.members.length).toBe(1);
    });
  });

  describe("SupabaseConfig & SupabaseProfile Fail-Fast Policy", () => {
    it("fails fast with SupabaseConfigurationError when config is missing", async () => {
      const MissingConfigLayer = Layer.effect(
        SupabaseConfig,
        Effect.gen(function* () {
          const url: string | undefined = undefined;
          const anonKey: string | undefined = undefined;

          if (!url || !anonKey) {
            return yield* Effect.fail(
              new SupabaseConfigurationError({
                message: "Supabase configuration is missing",
              })
            );
          }

          return { url, anonKey };
        })
      );

      const SupabaseServices = Layer.merge(
        SupabaseSessionLayer,
        SupabaseTripRoomRepositoryLayer
      );

      const BrokenSupabaseProfile = SupabaseServices.pipe(
        Layer.provide(SupabaseClientLayer.pipe(Layer.provide(MissingConfigLayer)))
      );

      const program = Effect.gen(function* () {
        yield* SessionService;
      });

      const exit = await Effect.runPromiseExit(
        program.pipe(Effect.provide(BrokenSupabaseProfile))
      );

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failureStr = JSON.stringify(exit.cause);
        expect(failureStr).toContain("SupabaseConfigurationError");
      }
    });

    it("succeeds building SupabaseProfile when valid SupabaseConfig is provided", async () => {
      const ValidConfigLayer = Layer.succeed(SupabaseConfig, {
        url: "https://example.supabase.co",
        anonKey: "test-anon-key",
      });

      const SupabaseServices = Layer.merge(
        SupabaseSessionLayer,
        SupabaseTripRoomRepositoryLayer
      );

      const ValidSupabaseProfile = SupabaseServices.pipe(
        Layer.provide(SupabaseClientLayer.pipe(Layer.provide(ValidConfigLayer)))
      );

      const program = Effect.gen(function* () {
        const sessionService = yield* SessionService;
        const tripRoomRepo = yield* TripRoomRepository;

        expect(sessionService).toBeDefined();
        expect(tripRoomRepo).toBeDefined();
      });

      await Effect.runPromise(program.pipe(Effect.provide(ValidSupabaseProfile)));
    });
  });

  describe("Supabase Dependency Injection (Session & Repository)", () => {
    it("uses the injected SupabaseClient for both SessionService and TripRoomRepository", async () => {
      let getSessionCalled = false;
      let fromCalledWith = "";

      const fakeClient = {
        auth: {
          getSession: async () => {
            getSessionCalled = true;
            return {
              data: {
                session: {
                  user: {
                    id: "user-123",
                    email: "test@example.com",
                    user_metadata: { name: "테스터" },
                  },
                },
              },
              error: null,
            };
          },
        },
        from: (table: string) => {
          fromCalledWith = table;
          return {
            select: () => ({
              then: (resolve: (val: any) => void) =>
                resolve({ data: [], error: null }),
            }),
          };
        },
      };

      const FakeSupabaseClientLayer = Layer.succeed(SupabaseClient, {
        client: fakeClient as any,
      });

      const Services = Layer.merge(
        SupabaseSessionLayer,
        SupabaseTripRoomRepositoryLayer
      ).pipe(Layer.provide(FakeSupabaseClientLayer));

      const program = Effect.gen(function* () {
        const sessionService = yield* SessionService;
        const tripRoomRepo = yield* TripRoomRepository;

        const session = yield* sessionService.getCurrentSession();
        expect(session.userId).toBe("user-123");
        expect(session.name).toBe("테스터");
        expect(getSessionCalled).toBe(true);

        const rooms = yield* tripRoomRepo.getRooms();
        expect(rooms).toEqual([]);
        expect(fromCalledWith).toBe("trip_rooms");
      });

      await Effect.runPromise(program.pipe(Effect.provide(Services)));
    });
  });
});
