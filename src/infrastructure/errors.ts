import { Schema } from "effect";

export class SupabaseConfigurationError extends Schema.TaggedError<SupabaseConfigurationError>()(
  "SupabaseConfigurationError",
  {
    message: Schema.String,
  }
) {}

export class InvalidDataBackendError extends Schema.TaggedError<InvalidDataBackendError>()(
  "InvalidDataBackendError",
  {
    backend: Schema.String,
    message: Schema.String,
  }
) {}

export class DatabaseConfigurationError extends Schema.TaggedError<DatabaseConfigurationError>()(
  "DatabaseConfigurationError",
  {
    message: Schema.String,
  }
) {}
