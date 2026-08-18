import { Effect, Layer, Schema } from "effect";
import {
  TripRoomRepository,
  type CreateRoomParams,
  type UpdateRoomParams,
} from "../../core/ports/trip-room-repository.ts";
import { TripRoomSchema } from "../../core/domain/room.ts";
import { ConflictError, NotFoundError } from "../../core/domain/errors.ts";
import { supabase } from "./supabase-client.ts";
import type { PlanId, Revision, TripId } from "../../core/domain/ids.ts";
import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
  TripRoom,
} from "../../core/domain/room.ts";

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

  createRoom: (params: CreateRoomParams) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("trip_rooms")
          .insert({
            title: params.title.trim(),
            destination: params.destination?.trim() || "여행지",
            start_date: params.startDate,
            end_date: params.endDate,
            host_user: params.hostUser,
          })
          .select()
          .single();
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: (error) =>
        new ConflictError({
          message:
            error instanceof Error
              ? `데이터 저장에 실패했습니다: ${error.message}`
              : "저장소에 데이터를 저장하지 못했습니다.",
          expectedRevision: RevisionSchema.make(0),
          actualRevision: RevisionSchema.make(0),
        }),
    }),

  updateRoom: (
    roomId: TripId,
    params: UpdateRoomParams,
    expectedRevision: Revision
  ) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.rpc("update_trip_room", {
          room_id: roomId,
          room_data: params,
          expected_revision: expectedRevision,
        });
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),

  createPlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.rpc("create_trip_plan", {
          room_id: roomId,
          plan_data: plan,
          expected_revision: expectedRevision,
        });
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),

  updatePlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.rpc("update_trip_plan", {
          room_id: roomId,
          plan_data: plan,
          expected_revision: expectedRevision,
        });
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),

  deletePlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.rpc("delete_trip_plan", {
          room_id: roomId,
          plan_id: planId,
          expected_revision: expectedRevision,
        });
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),

  confirmPlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
    Effect.tryPromise({
      try: async () => {
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

  setPlanOpinion: (
    roomId: TripId,
    planId: PlanId,
    opinion: PlanMemberOpinion,
    expectedRevision: Revision
  ) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.rpc("set_plan_opinion", {
          room_id: roomId,
          plan_id: planId,
          opinion_data: opinion,
          expected_revision: expectedRevision,
        });
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),

  joinRoom: (roomId: TripId, member: TripMember) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.rpc("join_trip_room", {
          room_id: roomId,
          member_data: member,
        });
        if (error) throw error;
        return Schema.decodeUnknownSync(TripRoomSchema)(data);
      },
      catch: () => new NotFoundError({ entity: "TripRoom", id: roomId }),
    }),
});
