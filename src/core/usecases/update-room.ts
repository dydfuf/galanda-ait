import { Effect } from "effect";
import {
  TripRoomRepository,
  type UpdateRoomParams,
} from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { requireRoomPermission } from "../domain/auth-guards.ts";
import type { Revision, TripId } from "../domain/ids.ts";
import { ValidationError } from "../domain/errors.ts";

export interface UpdateRoomInput {
  readonly roomId: TripId;
  readonly params: UpdateRoomParams;
  readonly expectedRevision: Revision;
}

export const updateTripRoom = Effect.fn("updateTripRoom")(
  function* (input: UpdateRoomInput) {
    // 1. 인증 세션 확인 (입력 검증보다 먼저 수행)
    const session = yield* requireAuthSession(
      "방 정보를 수정하려면 로그인이 필요합니다."
    );

    // 2. 수정 제목 유효성 검증
    if (input.params.title !== undefined && !input.params.title.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행 제목은 빈 값일 수 없습니다." })
      );
    }

    const repo = yield* TripRoomRepository;
    const currentRoom = yield* repo.getRoom(input.roomId);

    // 3. RBAC: 방장 권한('room:update') 검증
    yield* requireRoomPermission(
      currentRoom,
      session.participantIds,
      "room:update",
      "방장만 방 정보를 수정할 수 있습니다."
    );

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
  }
);
