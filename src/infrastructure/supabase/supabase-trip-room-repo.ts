import { Effect, Layer, Schema } from "effect";
import {
  TripRoomRepository,
  type CreateRoomParams,
  type UpdateRoomParams,
} from "../../core/ports/trip-room-repository.ts";
import { TripRoomSchema } from "../../core/domain/room.ts";
import {
  ConflictError,
  NotFoundError,
  RepositoryError,
} from "../../core/domain/errors.ts";
import { SupabaseClient, type SupabaseJsClient } from "./supabase-client.ts";
import { RevisionSchema, type PlanId, type Revision, type TripId } from "../../core/domain/ids.ts";
import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
  TripRoom,
} from "../../core/domain/room.ts";

const fetchActualRevision = (
  client: SupabaseJsClient,
  roomId: TripId,
  fallbackRevision: Revision
): Effect.Effect<Revision> =>
  Effect.promise(async () => {
    try {
      if (typeof client.from === "function") {
        const res = await client
          .from("trip_rooms")
          .select("revision")
          .eq("id", roomId)
          .maybeSingle();
        if (res.data && typeof res.data.revision === "number") {
          return RevisionSchema.make(res.data.revision);
        }
      }
    } catch {
      // fallback if query fails
    }
    return fallbackRevision;
  });

const callRpcRoomMutation = (
  client: SupabaseJsClient,
  rpcName: string,
  args: Record<string, unknown>,
  roomId: TripId,
  expectedRevision: Revision = RevisionSchema.make(0)
): Effect.Effect<TripRoom, NotFoundError | ConflictError | RepositoryError> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: async () => client.rpc(rpcName, args),
      catch: (cause) =>
        new RepositoryError({
          operation: rpcName,
          message:
            cause instanceof Error
              ? cause.message
              : "저장소 통신에 실패했습니다.",
        }),
    });

    if (result.error) {
      if (
        result.error.code === "P0001" ||
        result.error.message.toLowerCase().includes("conflict")
      ) {
        const actualRevision = yield* fetchActualRevision(
          client,
          roomId,
          expectedRevision
        );

        return yield* Effect.fail(
          new ConflictError({
            message: result.error.message,
            expectedRevision,
            actualRevision,
          })
        );
      }
      if (
        result.error.code === "PGRST116" ||
        result.error.message.toLowerCase().includes("not found")
      ) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }
      return yield* Effect.fail(
        new RepositoryError({
          operation: rpcName,
          message: result.error.message,
        })
      );
    }

    if (!result.data) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "TripRoom", id: roomId })
      );
    }

    return yield* Schema.decodeUnknownEffect(TripRoomSchema)(result.data).pipe(
      Effect.mapError(
        () =>
          new RepositoryError({
            operation: `${rpcName}.decode`,
            message: "저장소 응답 데이터 형식이 올바르지 않습니다.",
          })
      )
    );
  });

export const SupabaseTripRoomRepositoryLayer: Layer.Layer<
  TripRoomRepository,
  never,
  SupabaseClient
> = Layer.effect(
  TripRoomRepository,
  Effect.gen(function* () {
    const { client } = yield* SupabaseClient;

    return {
      getRooms: () =>
        Effect.gen(function* () {
          const data = yield* Effect.tryPromise({
            try: async () => {
              const { data, error } = await client.from("trip_rooms").select("*");
              if (error) throw error;
              return data ?? [];
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "getRooms",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행방 목록을 불러오지 못했습니다.",
              }),
          });

          return yield* Schema.decodeUnknownEffect(
            Schema.Array(TripRoomSchema)
          )(data).pipe(
            Effect.mapError(
              () =>
                new RepositoryError({
                  operation: "getRooms.decode",
                  message: "저장된 여행방 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      getRoom: (roomId: TripId) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client
                .from("trip_rooms")
                .select("*")
                .eq("id", roomId)
                .maybeSingle();
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "getRoom",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행방을 조회하지 못했습니다.",
              }),
          });

          if (result.error) {
            return yield* Effect.fail(
              new RepositoryError({
                operation: "getRoom",
                message: result.error.message,
              })
            );
          }

          if (!result.data) {
            return yield* Effect.fail(
              new NotFoundError({ entity: "TripRoom", id: roomId })
            );
          }

          return yield* Schema.decodeUnknownEffect(TripRoomSchema)(
            result.data
          ).pipe(
            Effect.mapError(
              () =>
                new RepositoryError({
                  operation: "getRoom.decode",
                  message: "저장된 여행방 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      createRoom: (params: CreateRoomParams) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client
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
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "createRoom",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행방을 생성하지 못했습니다.",
              }),
          });

          if (result.error) {
            return yield* Effect.fail(
              new RepositoryError({
                operation: "createRoom",
                message: result.error.message,
              })
            );
          }

          return yield* Schema.decodeUnknownEffect(TripRoomSchema)(
            result.data
          ).pipe(
            Effect.mapError(
              () =>
                new RepositoryError({
                  operation: "createRoom.decode",
                  message: "생성된 여행방 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      updateRoom: (
        roomId: TripId,
        params: UpdateRoomParams,
        expectedRevision: Revision
      ) =>
        callRpcRoomMutation(
          client,
          "update_trip_room",
          {
            room_id: roomId,
            room_data: params,
            expected_revision: expectedRevision,
          },
          roomId,
          expectedRevision
        ),

      createPlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
        callRpcRoomMutation(
          client,
          "create_trip_plan",
          {
            room_id: roomId,
            plan_data: plan,
            expected_revision: expectedRevision,
          },
          roomId,
          expectedRevision
        ),

      updatePlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
        callRpcRoomMutation(
          client,
          "update_trip_plan",
          {
            room_id: roomId,
            plan_data: plan,
            expected_revision: expectedRevision,
          },
          roomId,
          expectedRevision
        ),

      deletePlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
        callRpcRoomMutation(
          client,
          "delete_trip_plan",
          {
            room_id: roomId,
            plan_id: planId,
            expected_revision: expectedRevision,
          },
          roomId,
          expectedRevision
        ),

      confirmPlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
        callRpcRoomMutation(
          client,
          "confirm_trip_plan",
          {
            room_id: roomId,
            plan_id: planId,
            expected_revision: expectedRevision,
          },
          roomId,
          expectedRevision
        ),

      setPlanOpinion: (
        roomId: TripId,
        planId: PlanId,
        opinion: PlanMemberOpinion,
        expectedRevision: Revision
      ) =>
        callRpcRoomMutation(
          client,
          "set_plan_opinion",
          {
            room_id: roomId,
            plan_id: planId,
            opinion_data: opinion,
            expected_revision: expectedRevision,
          },
          roomId,
          expectedRevision
        ),

      joinRoom: (roomId: TripId, member: TripMember) =>
        callRpcRoomMutation(
          client,
          "join_trip_room",
          {
            room_id: roomId,
            member_data: member,
          },
          roomId
        ),
    };
  })
);


