import { Effect, Result, Schema } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import { calculatePlanDifference } from "../calculations/plan-diff.ts";
import {
  requireMutablePlan,
  requirePlanAuthor,
  requirePlanInRoom,
  requireRoomPermission,
} from "../domain/auth-guards.ts";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  type PlanId,
  type Revision,
  type TripId,
} from "../domain/ids.ts";
import {
  BookingStatusSchema,
  CityStaySchema,
  getRouteValidationError,
  PriceRangeSchema,
  TripPlaceSchema,
  TripPlanSchema,
  type AccommodationSnapshot,
  type CityStay,
  type TransportSnapshot,
  type TripPlace,
  type TripPlan,
} from "../domain/room.ts";
import { ValidationError } from "../domain/errors.ts";
import { deletePlanFromRoom } from "../domain/room-transitions.ts";

export type CreateAccommodationSnapshot = Pick<
  AccommodationSnapshot,
  | "id"
  | "city"
  | "period"
  | "nights"
  | "hotelName"
  | "isSearching"
  | "bookingStatus"
  | "priceRange"
  | "bookingUrl"
>;

export type CreateTransportSnapshot = Pick<
  TransportSnapshot,
  | "id"
  | "fromCity"
  | "toCity"
  | "mode"
  | "hasTransfer"
  | "durationText"
  | "bookingStatus"
  | "priceRange"
  | "bookingUrl"
>;

export interface CreatePlanCommand {
  readonly roomId: TripId;
  readonly expectedRevision: Revision;
  readonly title: string;
  readonly proposalReason?: string;
  readonly baseHeadcount?: number;
  readonly routes?: ReadonlyArray<CityStay>;
  readonly accommodations?: ReadonlyArray<CreateAccommodationSnapshot>;
  readonly transports?: ReadonlyArray<CreateTransportSnapshot>;
  readonly places: ReadonlyArray<TripPlace>;
  readonly cloneFromPlanId?: PlanId;
}

const CreatePlanCommandSchema = Schema.Struct({
  roomId: TripIdSchema,
  expectedRevision: RevisionSchema,
  title: Schema.String,
  proposalReason: Schema.optional(Schema.String),
  baseHeadcount: Schema.optional(Schema.Number),
  routes: Schema.optional(Schema.Array(CityStaySchema)),
  accommodations: Schema.optional(Schema.Array(Schema.Struct({
    id: Schema.String,
    city: Schema.String,
    period: Schema.String,
    nights: Schema.Number,
    hotelName: Schema.String,
    isSearching: Schema.optional(Schema.Boolean),
    bookingStatus: BookingStatusSchema,
    priceRange: Schema.optional(PriceRangeSchema),
    bookingUrl: Schema.optional(Schema.String),
  }))),
  transports: Schema.optional(Schema.Array(Schema.Struct({
    id: Schema.String,
    fromCity: Schema.String,
    toCity: Schema.String,
    mode: Schema.String,
    hasTransfer: Schema.Boolean,
    durationText: Schema.String,
    bookingStatus: BookingStatusSchema,
    priceRange: Schema.optional(PriceRangeSchema),
    bookingUrl: Schema.optional(Schema.String),
  }))),
  places: Schema.Array(TripPlaceSchema),
  cloneFromPlanId: Schema.optional(PlanIdSchema),
});

export const createPlan = Effect.fn("createPlan")(
  function* (input: CreatePlanCommand) {
    // 1. 인증 세션 확인 (단일 권한 주체, 입력 검증보다 먼저 수행)
    const session = yield* requireAuthSession(
      "여행안을 작성하려면 로그인이 필요합니다."
    );

    const decodeResult = Schema.decodeUnknownResult(CreatePlanCommandSchema)(input);
    if (Result.isFailure(decodeResult)) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행안 입력 형식이 올바르지 않습니다." })
      );
    }
    const command = decodeResult.success;

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(command.roomId);

    // 2. RBAC: 세션 사용자의 'plan:create' 권한 검증
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:create",
      "여행방 참여자만 여행안을 작성할 수 있습니다."
    );

    // 3. 여행안 입력 유효성 검증
    if (!command.title.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행안 제목을 입력해주세요." })
      );
    }

    if (command.baseHeadcount !== undefined && command.baseHeadcount < 1) {
      return yield* Effect.fail(
        new ValidationError({ message: "기준 인원수는 1명 이상이어야 합니다." })
      );
    }

    const routeError = getRouteValidationError(command.routes ?? []);
    if (routeError) {
      return yield* Effect.fail(new ValidationError({ message: routeError }));
    }

    const sourcePlan = command.cloneFromPlanId
      ? yield* requirePlanInRoom(room, command.cloneFromPlanId)
      : undefined;

    // 4. 비결정적 값과 서버 소유 필드 결정 (Application 경계)
    const ids = yield* IdGenerator;
    const generatedPlanId = yield* ids.planId;
    let finalPlan: TripPlan = {
      id: generatedPlanId,
      title: command.title.trim(),
      proposalReason: command.proposalReason,
      baseHeadcount: command.baseHeadcount,
      routes: command.routes,
      accommodations: command.accommodations,
      transports: command.transports,
      places: command.places,
      authorId: session.userId,
      authorName: session.name,
      status: "DRAFT",
      memberOpinions: [],
      voteCount: 0,
      clonedFromPlanId: sourcePlan?.id,
    };

    if (sourcePlan) {
      const diff = calculatePlanDifference(sourcePlan, finalPlan);
      finalPlan = { ...finalPlan, differenceSummary: diff.summaryText };
    }

    if (!Schema.is(TripPlanSchema)(finalPlan)) {
      return yield* Effect.fail(new ValidationError({ message: "여행안 날짜 형식이 올바르지 않습니다." }));
    }

    return yield* repo.createPlan(
      command.roomId,
      finalPlan,
      command.expectedRevision
    );
  }
);

export interface UpdatePlanInput {
  readonly roomId: TripId;
  readonly plan: TripPlan;
  readonly expectedRevision: Revision;
}

export const updatePlan = Effect.fn("updatePlan")(
  function* (input: UpdatePlanInput) {
    // 1. 인증 세션 확인 (입력 검증보다 먼저 수행)
    const session = yield* requireAuthSession(
      "여행안을 수정하려면 로그인이 필요합니다."
    );

    // 2. 여행안 제목 유효성 검증
    if (!input.plan.title?.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행안 제목을 입력해주세요." })
      );
    }

    // 3. 인원수 유효성 검증
    if (input.plan.baseHeadcount !== undefined && input.plan.baseHeadcount < 1) {
      return yield* Effect.fail(
        new ValidationError({ message: "기준 인원수는 1명 이상이어야 합니다." })
      );
    }

    const routeError = getRouteValidationError(input.plan.routes ?? []);
    if (routeError) {
      return yield* Effect.fail(new ValidationError({ message: routeError }));
    }

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);
    const existingPlan = yield* requirePlanInRoom(room, input.plan.id);

    // 4. RBAC: 세션 사용자의 'plan:update' 권한 검증
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:update",
      "여행방 참여자만 여행안을 수정할 수 있습니다."
    );

    // 5. ABAC: 여행안 작성자 소유권 권한 검증
    yield* requirePlanAuthor(
      room,
      existingPlan,
      session.userId,
      "여행안 작성자만 여행안을 수정할 수 있습니다."
    );

    // 6. 확정본 불변성 검증: 방 전체가 공유하는 공개본은 작성자도 수정할 수 없다
    yield* requireMutablePlan(
      room,
      existingPlan,
      "확정된 여행안은 수정할 수 없습니다."
    );

    // 작성자 정보 보존 및 기존에 authorId가 누락된 경우 유일 매칭 시 보정(backfill)
    const matchingMembers = existingPlan.authorName
      ? room.members.filter((m) => m.name === existingPlan.authorName)
      : [];
    const uniqueAuthorMember =
      matchingMembers.length === 1 ? matchingMembers[0] : undefined;

    const resolvedAuthorId =
      existingPlan.authorId ?? uniqueAuthorMember?.id;
    const resolvedAuthorName =
      existingPlan.authorName ?? uniqueAuthorMember?.name;

    // 7. 서버가 소유하는 필드는 입력값을 신뢰하지 않고 기존 여행안에서 이어받는다
    //    - status: 확정 Use Case만 변경할 수 있다
    //    - memberOpinions/voteCount: 의견 제출 Use Case만 변경할 수 있다 (타인의 의견·투표 보호)
    //    - clonedFromPlanId: 생성 시점에 정해지는 복제 계보이므로 수정 대상이 아니다
    //    입력에서 받는 값은 작성자가 편집하는 내용(제목, 제안 이유, 인원, 경로, 숙소, 교통, 장소)뿐이다
    let finalPlan: TripPlan = {
      ...input.plan,
      id: existingPlan.id,
      title: input.plan.title.trim(),
      status: existingPlan.status,
      authorId: resolvedAuthorId,
      authorName: resolvedAuthorName,
      clonedFromPlanId: existingPlan.clonedFromPlanId,
      memberOpinions: existingPlan.memberOpinions,
      voteCount: existingPlan.voteCount,
    };

    // 8. 복제된 여행안인 경우, 변경사항 재계산하여 동기화
    if (finalPlan.clonedFromPlanId) {
      const originalPlan = room.plans.find(
        (p) => p.id === finalPlan.clonedFromPlanId
      );
      if (originalPlan) {
        const diff = calculatePlanDifference(originalPlan, finalPlan);
        finalPlan = {
          ...finalPlan,
          differenceSummary: diff.summaryText,
        };
      }
    }

    if (!Schema.is(TripPlanSchema)(finalPlan)) {
      return yield* Effect.fail(new ValidationError({ message: "여행안 날짜 형식이 올바르지 않습니다." }));
    }

    return yield* repo.updatePlan(
      input.roomId,
      finalPlan,
      input.expectedRevision
    );
  }
);

export interface DeletePlanInput {
  readonly roomId: TripId;
  readonly planId: PlanId;
  readonly expectedRevision: Revision;
}

export const deletePlan = Effect.fn("deletePlan")(
  function* (input: DeletePlanInput) {
    // 1. 인증 세션 확인
    const session = yield* requireAuthSession(
      "여행안을 삭제하려면 로그인이 필요합니다."
    );

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);
    const plan = yield* requirePlanInRoom(room, input.planId);

    // 2. RBAC: 세션 사용자의 'plan:delete' 권한 검증
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:delete",
      "여행방 참여자만 여행안을 삭제할 수 있습니다."
    );

    // 3. ABAC: 여행안 작성자 소유권 권한 검증
    yield* requirePlanAuthor(
      room,
      plan,
      session.userId,
      "여행안 작성자만 여행안을 삭제할 수 있습니다."
    );

    // 4. 확정본 불변성 검증: 확정된 여행안을 지우면 방의 공개된 결정이 사라지므로 거부한다
    yield* requireMutablePlan(
      room,
      plan,
      "확정된 여행안은 삭제할 수 없습니다."
    );

    return yield* repo.saveRoom(
      deletePlanFromRoom(room, plan),
      input.expectedRevision
    );
  }
);
