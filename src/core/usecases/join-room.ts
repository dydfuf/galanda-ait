import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import type { TripId } from "../domain/ids.ts";
import type { TripMember, TripRoom } from "../domain/room.ts";
import {
  ValidationError,
  type ConflictError,
  type NotFoundError,
} from "../domain/errors.ts";

export interface JoinRoomInput {
  readonly roomId: TripId;
  readonly member: TripMember;
}

export const joinTripRoomUseCase = (
  input: JoinRoomInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError,
  TripRoomRepository
> =>
  Effect.gen(function* () {
    // 1. 참여자 정보 유효성 검증
    if (!input.member?.name?.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "참여자 이름을 입력해주세요." })
      );
    }

    const repo = yield* TripRoomRepository;

    // 2. 방 존재 여부 및 기존 참여 여부 확인 (멱등성 보장)
    const room = yield* repo.getRoom(input.roomId);
    const alreadyMember = room.members.some((m) => m.id === input.member.id);
    if (alreadyMember) {
      return room;
    }

    // 3. 참여 등록 실행
    return yield* repo.joinRoom(input.roomId, {
      ...input.member,
      name: input.member.name.trim(),
    });
  });
