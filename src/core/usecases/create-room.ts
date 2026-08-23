import { Effect, Result, Schema } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireRegisteredSession } from "../ports/session.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import { ValidationError } from "../domain/errors.ts";
import type { TripMember } from "../domain/room.ts";

export const CreateRoomInputSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  destination: Schema.optional(Schema.String),
});

/**
 * 방 생성 입력
 * - 호스트(actor)는 세션에서만 결정되므로 호출자가 사용자 신원을 넘길 수 없다
 */
export interface CreateRoomInput {
  readonly title: string;
  readonly destination?: string;
}

export const createTripRoom = Effect.fn("createTripRoom")(
  function* (input: CreateRoomInput) {
    // 1. 인증 세션 확인 및 호스트 사용자 바인딩 (세션 사용자 단일 주체 강제)
    //    입력 검증보다 먼저 수행해 비로그인 사용자가 ValidationError를 먼저 받지 않도록 한다
    const session = yield* requireRegisteredSession(
      "새 여행을 만들려면 소셜 계정 연결이 필요합니다."
    );

    // 2. 입력 스키마 검증
    const decodeResult = Schema.decodeUnknownResult(CreateRoomInputSchema)({
      ...input,
      title: input.title?.trim(),
    });

    if (Result.isFailure(decodeResult)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "여행 제목을 입력해주세요.",
        })
      );
    }

    const validated = decodeResult.success;

    // 3. 비결정적 값(ID) 결정 (Use Case / Effect 경계)
    const ids = yield* IdGenerator;
    const id = yield* ids.tripId;

    const hostUser: TripMember = {
      id: session.participantId,
      name: session.name,
      role: "HOST",
    };

    // 4. 저장소 생성 요청
    const repo = yield* TripRoomRepository;
    return yield* repo.createRoom({
      id,
      title: validated.title,
      destination: validated.destination,
      hostUser,
    });
  }
);
