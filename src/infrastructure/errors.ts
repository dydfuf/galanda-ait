import { Schema } from "effect";

export class DatabaseConfigurationError extends Schema.TaggedError<DatabaseConfigurationError>()(
  "DatabaseConfigurationError",
  {
    message: Schema.String,
  }
) {}
