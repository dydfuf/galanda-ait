import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { SessionService, requireAuthSession } from "../ports/session.ts";
import type { TripId } from "../domain/ids.ts";
import type { TripMember, TripRoom } from "../domain/room.ts";
import type {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../domain/errors.ts";

export interface JoinRoomInput {
  readonly roomId: TripId;
  readonly member?: Partial<TripMember>;
}

export const joinTripRoomUseCase = (
  input: JoinRoomInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError | UnauthorizedError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 인증된 세션 확인 (세션 사용자 단일 주체 강제)
    const session = yield* requireAuthSession(
      "방에 참여하려면 로그인이 필요합니다."
    );

    const repo = yield* TripRoomRepository;

    // 2. 방 존재 여부 및 기존 참여 여부 확인 (멱등성 보장)
    const room = yield* repo.getRoom(input.roomId);
    const alreadyMember = room.members.some((m) => m.id === session.userId);
    if (alreadyMember) {
      return room;
    }

    // 3. 참여 등록 실행 (세션 사용자의 userId 및 name 바인딩)
    const member: TripMember = {
      id: session.userId,
      name: session.name,
      role: "MEMBER",
    };

    return yield* repo.joinRoom(input.roomId, member);
  });
