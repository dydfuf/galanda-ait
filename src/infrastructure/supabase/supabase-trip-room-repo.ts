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
import { SupabaseClient } from "./supabase-client.ts";
import type { PlanId, Revision, TripId } from "../../core/domain/ids.ts";
import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
} from "../../core/domain/room.ts";

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
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("update_trip_room", {
                room_id: roomId,
                room_data: params,
                expected_revision: expectedRevision,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "updateRoom",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행방을 수정하지 못했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision,
                  actualRevision: expectedRevision,
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
                operation: "updateRoom",
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
                  operation: "updateRoom.decode",
                  message: "수정된 여행방 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      createPlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("create_trip_plan", {
                room_id: roomId,
                plan_data: plan,
                expected_revision: expectedRevision,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "createPlan",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행안을 생성하지 못했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision,
                  actualRevision: expectedRevision,
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
                operation: "createPlan",
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
                  operation: "createPlan.decode",
                  message: "여행안 생성 후 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      updatePlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("update_trip_plan", {
                room_id: roomId,
                plan_data: plan,
                expected_revision: expectedRevision,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "updatePlan",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행안을 수정하지 못했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision,
                  actualRevision: expectedRevision,
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
                operation: "updatePlan",
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
                  operation: "updatePlan.decode",
                  message: "여행안 수정 후 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      deletePlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("delete_trip_plan", {
                room_id: roomId,
                plan_id: planId,
                expected_revision: expectedRevision,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "deletePlan",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행안을 삭제하지 못했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision,
                  actualRevision: expectedRevision,
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
                operation: "deletePlan",
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
                  operation: "deletePlan.decode",
                  message: "여행안 삭제 후 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      confirmPlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("confirm_trip_plan", {
                room_id: roomId,
                plan_id: planId,
                expected_revision: expectedRevision,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "confirmPlan",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행안을 확정하지 못했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision,
                  actualRevision: expectedRevision,
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
                operation: "confirmPlan",
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
                  operation: "confirmPlan.decode",
                  message: "여행안 확정 후 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      setPlanOpinion: (
        roomId: TripId,
        planId: PlanId,
        opinion: PlanMemberOpinion,
        expectedRevision: Revision
      ) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("set_plan_opinion", {
                room_id: roomId,
                plan_id: planId,
                opinion_data: opinion,
                expected_revision: expectedRevision,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "setPlanOpinion",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "의견을 등록하지 못했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision,
                  actualRevision: expectedRevision,
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
                operation: "setPlanOpinion",
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
                  operation: "setPlanOpinion.decode",
                  message: "의견 등록 후 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),

      joinRoom: (roomId: TripId, member: TripMember) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await client.rpc("join_trip_room", {
                room_id: roomId,
                member_data: member,
              });
              return res;
            },
            catch: (cause) =>
              new RepositoryError({
                operation: "joinRoom",
                message:
                  cause instanceof Error
                    ? cause.message
                    : "여행방 참여에 실패했습니다.",
              }),
          });

          if (result.error) {
            if (
              result.error.code === "P0001" ||
              result.error.message.toLowerCase().includes("conflict")
            ) {
              return yield* Effect.fail(
                new ConflictError({
                  message: result.error.message,
                  expectedRevision: 0,
                  actualRevision: 0,
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
                operation: "joinRoom",
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
                  operation: "joinRoom.decode",
                  message: "여행방 참여 후 데이터 형식이 올바르지 않습니다.",
                })
            )
          );
        }),
    };
  })
);

