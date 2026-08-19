import { Context, Effect, Layer } from "effect";
import { InvalidDataBackendError, SupabaseConfigurationError } from "../errors.ts";

export type DataBackend = "local" | "supabase";

export interface SupabaseConfigValue {
  readonly url: string;
  readonly anonKey: string;
}

export class SupabaseConfig extends Context.Service<
  SupabaseConfig,
  SupabaseConfigValue
>()("galanda/SupabaseConfig") {}

export const resolveDataBackend = (
  rawBackend?: string,
  rawUseSupabase?: string
): DataBackend => {
  if (rawBackend !== undefined && rawBackend !== "") {
    if (rawBackend === "local" || rawBackend === "supabase") {
      return rawBackend;
    }
    throw new InvalidDataBackendError({
      backend: rawBackend,
      message: `Invalid VITE_DATA_BACKEND value: "${rawBackend}". Expected "local" or "supabase".`,
    });
  }

  if (rawUseSupabase === "true") {
    return "supabase";
  }

  return "local";
};

export const getDataBackend = (): DataBackend => {
  const rawBackend =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_DATA_BACKEND
      : undefined;
  const rawUseSupabase =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_USE_SUPABASE
      : undefined;

  return resolveDataBackend(rawBackend, rawUseSupabase);
};

export const SupabaseConfigViteLayer: Layer.Layer<
  SupabaseConfig,
  SupabaseConfigurationError
> = Layer.effect(
  SupabaseConfig,
  Effect.gen(function* () {
    const url =
      typeof import.meta !== "undefined"
        ? import.meta.env?.VITE_SUPABASE_URL
        : undefined;
    const anonKey =
      typeof import.meta !== "undefined"
        ? import.meta.env?.VITE_SUPABASE_ANON_KEY
        : undefined;

    if (!url || !anonKey) {
      return yield* Effect.fail(
        new SupabaseConfigurationError({
          message:
            "Supabase configuration is missing: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.",
        })
      );
    }

    return {
      url,
      anonKey,
    };
  })
);
