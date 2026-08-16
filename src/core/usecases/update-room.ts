import { Effect } from "effect";
import {
  TripRoomRepository,
  type UpdateRoomParams,
} from "../ports/trip-room-repository.ts";
import { SessionService, requireAuthSession } from "../ports/session.ts";
import { requireRoomPermission } from "../domain/auth-guards.ts";
import type { Revision, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import {
  ValidationError,
  type ConflictError,
  type NotFoundError,
  type UnauthorizedError,
} from "../domain/errors.ts";

export interface UpdateRoomInput {
  readonly roomId: TripId;
  readonly params: UpdateRoomParams;
  readonly expectedRevision: Revision;
}

export const updateTripRoomUseCase = (
  input: UpdateRoomInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError | UnauthorizedError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 수정 제목 유효성 검증
    if (input.params.title !== undefined && !input.params.title.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행 제목은 빈 값일 수 없습니다." })
      );
    }

    // 2. 인증 세션 및 방 조회
    const session = yield* requireAuthSession(
      "방 정보를 수정하려면 로그인이 필요합니다."
    );
    const repo = yield* TripRoomRepository;
    const currentRoom = yield* repo.getRoom(input.roomId);

    // 3. RBAC: 방장 권한('room:update') 검증
    yield* requireRoomPermission(
      currentRoom,
      session.userId,
      "room:update",
      "방장만 방 정보를 수정할 수 있습니다."
    );

    // 4. 날짜 정합성 검증 (수정될 날짜와 기존 날짜 결합 확인)
    const effectiveStartDate =
      input.params.startDate ?? currentRoom.startDate;
    const effectiveEndDate = input.params.endDate ?? currentRoom.endDate;

    if (
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveStartDate > effectiveEndDate
    ) {
      return yield* Effect.fail(
        new ValidationError({
          message: "여행 종료일은 시작일 이후여야 합니다.",
        })
      );
    }

    const sanitizedParams: UpdateRoomParams = {
      ...input.params,
      title:
        input.params.title !== undefined
          ? input.params.title.trim()
          : undefined,
      destination:
        input.params.destination !== undefined
          ? input.params.destination.trim()
          : undefined,
    };

    return yield* repo.updateRoom(
      input.roomId,
      sanitizedParams,
      input.expectedRevision
    );
  });
