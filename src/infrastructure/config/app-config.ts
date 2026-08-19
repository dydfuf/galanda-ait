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

export interface ResolveDataBackendOptions {
  readonly rawBackend?: string;
  readonly rawUseSupabase?: string;
  readonly supabaseUrl?: string;
  readonly supabaseAnonKey?: string;
  readonly isProd?: boolean;
}

export function resolveDataBackend(
  optionsOrRawBackend?: ResolveDataBackendOptions | string,
  legacyRawUseSupabase?: string
): DataBackend {
  const options: ResolveDataBackendOptions =
    typeof optionsOrRawBackend === "string" ||
    (optionsOrRawBackend === undefined && legacyRawUseSupabase !== undefined)
      ? {
          rawBackend: optionsOrRawBackend,
          rawUseSupabase: legacyRawUseSupabase,
        }
      : (optionsOrRawBackend ?? {});

  const { rawBackend, rawUseSupabase, supabaseUrl, supabaseAnonKey, isProd } =
    options;

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
  if (rawUseSupabase === "false") {
    return "local";
  }

  // Supabase 환경변수가 일부라도 설정되어 있다면 Supabase backend 의도로 간주하여 fail-fast 유도
  if (supabaseUrl || supabaseAnonKey) {
    return "supabase";
  }

  // 프로덕션 배포 환경에서는 기본 backend를 supabase로 강제하여 LocalProfile 조용히 실행 방지
  if (isProd) {
    return "supabase";
  }

  return "local";
}

export const getDataBackend = (): DataBackend => {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;

  return resolveDataBackend({
    rawBackend: env?.VITE_DATA_BACKEND,
    rawUseSupabase: env?.VITE_USE_SUPABASE,
    supabaseUrl: env?.VITE_SUPABASE_URL,
    supabaseAnonKey: env?.VITE_SUPABASE_ANON_KEY,
    isProd: env?.PROD ?? false,
  });
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
