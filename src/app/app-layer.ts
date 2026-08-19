import { Layer } from "effect";
import { LocalSessionLayer } from "../infrastructure/local/local-session.ts";
import { LocalTripRoomRepositoryLayer } from "../infrastructure/local/local-trip-room-repo.ts";
import { SupabaseSessionLayer } from "../infrastructure/supabase/supabase-session.ts";
import { SupabaseTripRoomRepositoryLayer } from "../infrastructure/supabase/supabase-trip-room-repo.ts";
import { SupabaseClientLayer } from "../infrastructure/supabase/supabase-client.ts";
import {
  getDataBackend,
  SupabaseConfigViteLayer,
} from "../infrastructure/config/app-config.ts";

export const LocalProfile = Layer.merge(
  LocalSessionLayer,
  LocalTripRoomRepositoryLayer
);

const SupabaseServices = Layer.merge(
  SupabaseSessionLayer,
  SupabaseTripRoomRepositoryLayer
);

const SupabaseInfrastructure = SupabaseClientLayer.pipe(
  Layer.provide(SupabaseConfigViteLayer)
);

export const SupabaseProfile = SupabaseServices.pipe(
  Layer.provide(SupabaseInfrastructure)
);

const backend = getDataBackend();

export const AppLayer = backend === "supabase" ? SupabaseProfile : LocalProfile;
