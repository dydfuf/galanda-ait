import { Layer } from "effect";
import { LocalSessionLayer } from "../infrastructure/local/local-session.ts";
import { LocalTripRoomRepositoryLayer } from "../infrastructure/local/local-trip-room-repo.ts";
import { SupabaseSessionLayer } from "../infrastructure/supabase/supabase-session.ts";
import { SupabaseTripRoomRepositoryLayer } from "../infrastructure/supabase/supabase-trip-room-repo.ts";

export const LocalProfile = Layer.merge(
  LocalSessionLayer,
  LocalTripRoomRepositoryLayer
);

export const SupabaseProfile = Layer.merge(
  SupabaseSessionLayer,
  SupabaseTripRoomRepositoryLayer
);

const isSupabaseEnabled =
  typeof import.meta !== "undefined" &&
  import.meta.env?.VITE_USE_SUPABASE === "true";

export const AppLayer = isSupabaseEnabled ? SupabaseProfile : LocalProfile;
