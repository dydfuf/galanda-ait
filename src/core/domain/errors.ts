import { Schema } from "effect";

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    entity: Schema.String,
    id: Schema.String,
  }
) {}

export class ConflictError extends Schema.TaggedError<ConflictError>()(
  "ConflictError",
  {
    message: Schema.String,
    expectedRevision: Schema.Number,
    actualRevision: Schema.Number,
  }
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
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
