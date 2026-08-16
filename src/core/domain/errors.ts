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

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}
