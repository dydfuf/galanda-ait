import { Effect, Option, Result, Schema } from "effect";
import {
  TripRoomRepository,
  type CreateRoomParams,
} from "../ports/trip-room-repository.ts";
import { SessionService, getOptionalSession } from "../ports/session.ts";
import { TripMemberSchema } from "../domain/room.ts";
import { ValidationError, type NotFoundError } from "../domain/errors.ts";
import type { TripMember, TripRoom } from "../domain/room.ts";

export const CreateRoomInputSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  destination: Schema.optional(Schema.String),
  startDate: Schema.optional(Schema.String),
  endDate: Schema.optional(Schema.String),
  hostUser: Schema.optional(TripMemberSchema),
});

export type CreateRoomInput = CreateRoomParams;

export const createTripRoomUseCase = (
  input: CreateRoomInput
): Effect.Effect<
  TripRoom,
  ValidationError | NotFoundError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 입력 스키마 검증
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

    // 2. 날짜 정합성 검증
    if (
      validated.startDate &&
      validated.endDate &&
      validated.startDate > validated.endDate
    ) {
      return yield* Effect.fail(
        new ValidationError({
          message: "여행 종료일은 시작일 이후여야 합니다.",
        })
      );
    }

    // 3. 호스트 사용자 정보 자동 바인딩 (추상화된 세션 헬퍼 활용)
    let hostUser: TripMember | undefined = validated.hostUser;
    if (!hostUser) {
      const sessionOpt = yield* getOptionalSession;
      if (Option.isSome(sessionOpt)) {
        hostUser = {
          id: sessionOpt.value.userId,
          name: sessionOpt.value.name,
          role: "HOST",
        };
      }
    }

    // 4. 저장소 생성 요청
    const repo = yield* TripRoomRepository;
    return yield* repo.createRoom({
      title: validated.title,
      destination: validated.destination,
      startDate: validated.startDate,
      endDate: validated.endDate,
      hostUser,
    });
  });
