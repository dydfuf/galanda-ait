import { validator } from "hono/validator";
import { Schema, Result } from "effect";
import type { SchemaAST } from "effect";
import { formatApiError } from "./api-error.ts";

export type SupportedValidationTarget = "json" | "param" | "query";

export const effectValidator = <
  Target extends SupportedValidationTarget,
  S extends Schema.Decoder<any, never>,
>(
  target: Target,
  schema: S,
  options?: SchemaAST.ParseOptions
) => {
  const decode = Schema.decodeUnknownResult(schema, options);
  return validator(target, (value, c) => {
    const result = decode(value);
    return Result.match(result, {
      onSuccess: (decoded) => decoded as S["Type"],
      onFailure: () => {
        const requestId =
          (c.var as { requestId?: string } | undefined)?.requestId ??
          crypto.randomUUID();

        return c.json(
          formatApiError({
            code: "INVALID_REQUEST",
            message: "요청 형식이 올바르지 않습니다.",
            requestId,
          }),
          400
        );
      },
    });
  });
};
