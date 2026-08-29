import { Schema } from "effect";

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    entity: Schema.String,
    id: Schema.String,
  }
) {}

export class RevisionConflictError extends Schema.TaggedError<RevisionConflictError>()(
  "RevisionConflictError",
  {
    message: Schema.String,
    expectedRevision: Schema.Number,
    actualRevision: Schema.Number,
  }
) {}

export class StateConflictError extends Schema.TaggedError<StateConflictError>()(
  "StateConflictError",
  {
    message: Schema.String,
  }
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
  {
    reason: Schema.String,
  }
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  "ForbiddenError",
  {
    reason: Schema.String,
  }
) {}

export class AccountUpgradeRequiredError extends Schema.TaggedError<AccountUpgradeRequiredError>()(
  "AccountUpgradeRequiredError",
  { reason: Schema.String }
) {}

/** Public invite failures intentionally collapse malformed, expired, revoked, and missing tokens. */
export class InvalidInviteError extends Schema.TaggedError<InvalidInviteError>()(
  "InvalidInviteError",
  {}
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}

/**
 * 세션 저장소·인증 서버에 접근하지 못해 현재 사용자를 판별할 수 없는 상태
 * - "로그인하지 않음"(UnauthorizedError)과 구분하기 위한 별도 오류
 * - 화면은 이 오류를 비로그인이 아닌 일시적 장애로 안내해야 함
 */
export class SessionUnavailableError extends Schema.TaggedError<SessionUnavailableError>()(
  "SessionUnavailableError",
  {
    reason: Schema.String,
  }
) {}

export class RepositoryError extends Schema.TaggedError<RepositoryError>()(
  "RepositoryError",
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

/**
 * Explore listing이 더 이상 공개 상태가 아님(gone).
 *
 * - listing record는 존재하지만 UNLISTED(게시 중단)여서 공개 detail을 제공할 수
 *   없는 상태를 "존재하지 않음"(NotFoundError)과 명시적으로 구분한다.
 * - source private aggregate를 read-through한 cached fallback을 절대 제공하지
 *   않는다. UNLISTED/삭제/무효는 오직 이 typed error 또는 NotFound로만 표현한다.
 * - HTTP 경계는 이 오류를 410 GONE + `LISTING_UNAVAILABLE`로 매핑한다.
 */
export class ExploreListingUnavailableError extends Schema.TaggedError<ExploreListingUnavailableError>()(
  "ExploreListingUnavailableError",
  {}
) {}
