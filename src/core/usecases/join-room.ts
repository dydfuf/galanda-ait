import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import type { TripId } from "../domain/ids.ts";
import type { TripMember } from "../domain/room.ts";
import {
  joinRoomMember,
  mergeParticipantIdentityInRoom,
} from "../domain/room-transitions.ts";

/**
 * 방 참여 입력
 * - 참여자 신원은 세션에서만 결정되므로 호출자가 member 정보를 넘길 수 없다
 */
export interface JoinRoomInput {
  readonly roomId: TripId;
}

export const joinTripRoom = Effect.fn("joinTripRoom")(
  function* (input: JoinRoomInput) {
    // 1. 인증된 세션 확인 (세션 사용자 단일 주체 강제)
    const session = yield* requireAuthSession(
      "방에 참여하려면 로그인이 필요합니다."
    );

    const repo = yield* TripRoomRepository;

    // 2. 방 존재 여부 확인
    const storedRoom = yield* repo.getRoom(input.roomId);
    const room = mergeParticipantIdentityInRoom(
      storedRoom,
      session.participantId,
      session.participantIds
    );

    // 3. 세션 사용자의 userId 및 name으로 멱등 상태 전이
    const member: TripMember = {
      id: session.participantId,
      name: session.name,
      role: "MEMBER",
    };

    const updatedRoom = joinRoomMember(room, member);
    return updatedRoom === storedRoom
      ? storedRoom
      : yield* repo.saveRoom(updatedRoom, storedRoom.revision);
  }
);
