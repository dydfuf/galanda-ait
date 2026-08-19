import { Context, Effect, Layer } from "effect";
import {
  createClient,
  type SupabaseClient as SupabaseJsClient,
} from "@supabase/supabase-js";
import { SupabaseConfig } from "../config/app-config.ts";

export type { SupabaseJsClient };

export class SupabaseClient extends Context.Service<
  SupabaseClient,
  {
    readonly client: SupabaseJsClient;
  }
>()("galanda/SupabaseClient") {}

export const makeSupabaseClient: Effect.Effect<
  { readonly client: SupabaseJsClient },
  never,
  SupabaseConfig
> = Effect.gen(function* () {
  const config = yield* SupabaseConfig;
  const client = createClient(config.url, config.anonKey);
  return { client };
});

export const SupabaseClientLayer: Layer.Layer<
  SupabaseClient,
  never,
  SupabaseConfig
> = Layer.effect(SupabaseClient, makeSupabaseClient);
