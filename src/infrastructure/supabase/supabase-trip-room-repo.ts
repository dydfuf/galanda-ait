import { Effect, Layer, Schema } from "effect";
import { TripRoomRepository } from "../../core/ports/trip-room-repository.ts";
import { TripRoomSchema } from "../../core/domain/room.ts";
import { ConflictError, NotFoundError } from "../../core/domain/errors.ts";
import { supabase } from "./supabase-client.ts";
import type { PlanId, Revision, TripId } from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";

export const SupabaseTripRoomRepositoryLayer = Layer.succeed(TripRoomRepository, {
  getRooms: () =>
    Effect.tryPromise(async () => {
      const { data, error } = await supabase.from("trip_rooms").select("*");
      if (error) throw error;
      return Schema.decodeUnknownSync(Schema.Array(TripRoomSchema))(data);
    }).pipe(
      Effect.orElseSucceed(() => [] as ReadonlyArray<TripRoom>)
    ),

  getRoom: (roomId: TripId) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("trip_rooms")
          .select("*")
          .eq("id", roomId)
          .single();
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),

  confirmPlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
    Effect.tryPromise({
      try: async () => {
        // 원자적 Database Function 호출 (revision 일치 시에만 업데이트)
        const { data, error } = await supabase.rpc("confirm_trip_plan", {
          room_id: roomId,
          plan_id: planId,
          expected_revision: expectedRevision,
        });

        if (error) {
          if (error.code === "P0001" || error.message.includes("conflict")) {
            throw new ConflictError({
              message: error.message,
              expectedRevision,
              actualRevision: expectedRevision,
            });
          }
          throw error;
        }
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: (e) =>
        e instanceof ConflictError
          ? e
          : new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),
});
