import { Schema } from "effect";

class ResponseTooLargeError extends Error {
  constructor() {
    super("Response too large");
  }
}

export async function readBoundedText(response: Response, maxBytes: number, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  const abort = () => { void reader.cancel(signal?.reason).catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new ResponseTooLargeError();
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export const requestOpenRouter = (
  gateway: Pick<AiGateway, "run">,
  input: {
    readonly model: string;
    readonly instructions: string;
    readonly input: string;
    readonly schemaName: string;
    readonly schema: Record<string, unknown>;
    readonly maxTokens: number;
    readonly reasoning?: { readonly effort: "low" };
  },
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Response> => gateway.run({
  provider: "openrouter",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  // BYOK supplies the provider key; the binding supplies Cloudflare authorization.
  headers: { "cf-aig-collect-log-payload": "true" },
  query: {
    model: input.model,
    messages: [
      { role: "system", content: input.instructions },
      { role: "user", content: input.input },
    ],
    max_tokens: input.maxTokens,
    ...(input.reasoning ? { reasoning: input.reasoning } : {}),
    response_format: {
      type: "json_schema",
      json_schema: { name: input.schemaName, strict: true, schema: input.schema },
    },
    provider: { require_parameters: true, data_collection: "deny" },
  },
}, {
  signal,
  extraHeaders: {
    "cf-aig-collect-log-payload": "true",
    "cf-aig-skip-cache": "true",
    "cf-aig-request-timeout": String(timeoutMs),
    "cf-aig-max-attempts": "1",
  },
});

const MAX_COMPLETION_BYTES = 150_000;

export type OpenRouterCompletionFailure =
  | "RESPONSE_READ"
  | "RESPONSE_TOO_LARGE"
  | "RESPONSE_JSON"
  | "ENVELOPE_SCHEMA"
  | "FINISH_REASON"
  | "REFUSAL"
  | "EMPTY_CONTENT";

export interface OpenRouterCompletionDiagnostics {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | "function_call" | "error" | "OTHER";
  readonly contentLength?: number;
  readonly refusal?: boolean;
  readonly choiceCount?: number;
}

export class OpenRouterCompletionError extends Error {
  readonly name = "OpenRouterCompletionError";
  readonly failure: OpenRouterCompletionFailure;
  readonly diagnostics: OpenRouterCompletionDiagnostics;

  constructor(failure: OpenRouterCompletionFailure, diagnostics: OpenRouterCompletionDiagnostics) {
    super(`OpenRouter completion rejected: ${failure}`);
    this.failure = failure;
    this.diagnostics = diagnostics;
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const safeTokenCount = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

const safeFinishReason = (value: unknown): OpenRouterCompletionDiagnostics["finishReason"] => {
  switch (value) {
    case "stop":
    case "length":
    case "content_filter":
    case "tool_calls":
    case "function_call":
    case "error":
      return value;
    default:
      return "OTHER";
  }
};

const completionDiagnostics = (value: unknown): OpenRouterCompletionDiagnostics => {
  const body = asRecord(value);
  const usage = asRecord(body?.usage);
  const choices = Array.isArray(body?.choices) ? body.choices : undefined;
  const choice = asRecord(choices?.[0]);
  const message = asRecord(choice?.message);
  // Only bounded numbers, booleans and allowlisted values may leave this boundary.
  return Object.freeze({
    inputTokens: safeTokenCount(usage?.prompt_tokens),
    outputTokens: safeTokenCount(usage?.completion_tokens),
    totalTokens: safeTokenCount(usage?.total_tokens),
    ...(choices ? { choiceCount: Math.min(choices.length, MAX_COMPLETION_BYTES) } : {}),
    ...(choice && "finish_reason" in choice ? { finishReason: safeFinishReason(choice.finish_reason) } : {}),
    ...(typeof message?.content === "string" ? { contentLength: Math.min(message.content.length, MAX_COMPLETION_BYTES) } : {}),
    ...(message?.content === null ? { contentLength: 0 } : {}),
    ...(message ? { refusal: message.refusal != null } : {}),
  });
};

const CompletionEnvelopeSchema = Schema.Struct({
  choices: Schema.Array(Schema.Struct({
    finish_reason: Schema.NullOr(Schema.String),
    message: Schema.Struct({
      content: Schema.NullOr(Schema.String),
      refusal: Schema.optional(Schema.Unknown),
    }),
  })).check(Schema.isLengthBetween(1, 1)),
  // Preserve the existing envelope contract independently of diagnostic recovery.
  usage: Schema.optional(Schema.NullOr(Schema.Struct({
    prompt_tokens: Schema.Number,
    completion_tokens: Schema.Number,
    total_tokens: Schema.Number,
  }))),
});

export const readOpenRouterCompletion = async (
  response: Response,
  signal?: AbortSignal,
  onDiagnostics?: (diagnostics: OpenRouterCompletionDiagnostics) => void,
) => {
  const emitDiagnostics = (diagnostics: OpenRouterCompletionDiagnostics) => {
    try {
      onDiagnostics?.(diagnostics);
    } catch {
      // Observers must not change completion validation.
    }
  };
  const emptyDiagnostics = completionDiagnostics(undefined);
  let text: string;
  try {
    text = await readBoundedText(response, MAX_COMPLETION_BYTES, signal);
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"))) {
      throw error;
    }
    emitDiagnostics(emptyDiagnostics);
    throw new OpenRouterCompletionError(error instanceof ResponseTooLargeError ? "RESPONSE_TOO_LARGE" : "RESPONSE_READ", emptyDiagnostics);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    emitDiagnostics(emptyDiagnostics);
    throw new OpenRouterCompletionError("RESPONSE_JSON", emptyDiagnostics);
  }

  const diagnostics = completionDiagnostics(payload);
  emitDiagnostics(diagnostics);
  let body: typeof CompletionEnvelopeSchema.Type;
  try {
    body = Schema.decodeUnknownSync(CompletionEnvelopeSchema)(payload);
  } catch {
    // Schema issues can retain raw values; never attach them as an error cause.
    throw new OpenRouterCompletionError("ENVELOPE_SCHEMA", diagnostics);
  }
  const choice = body.choices[0]!;
  if (choice.finish_reason !== "stop") throw new OpenRouterCompletionError("FINISH_REASON", diagnostics);
  if (choice.message.refusal != null) throw new OpenRouterCompletionError("REFUSAL", diagnostics);
  const content = choice.message.content;
  if (content === null || content.trim().length === 0) throw new OpenRouterCompletionError("EMPTY_CONTENT", diagnostics);
  return {
    content,
    inputTokens: diagnostics.inputTokens,
    outputTokens: diagnostics.outputTokens,
    totalTokens: diagnostics.totalTokens,
  };
};
