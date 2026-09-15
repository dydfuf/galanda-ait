import { Schema } from "effect";

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
      if (bytes > maxBytes) throw new Error("Response too large");
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

const CompletionSchema = Schema.Struct({
  choices: Schema.Array(Schema.Struct({
    finish_reason: Schema.Literal("stop"),
    message: Schema.Struct({
      content: Schema.String.check(Schema.isMinLength(1)),
      refusal: Schema.optional(Schema.Null),
    }),
  })).check(Schema.isLengthBetween(1, 1)),
  usage: Schema.optional(Schema.NullOr(Schema.Struct({
    prompt_tokens: Schema.Number,
    completion_tokens: Schema.Number,
    total_tokens: Schema.Number,
  }))),
});

export const readOpenRouterCompletion = async (response: Response, signal?: AbortSignal) => {
  const body = Schema.decodeUnknownSync(CompletionSchema)(
    JSON.parse(await readBoundedText(response, 150_000, signal)),
  );
  return {
    content: body.choices[0]!.message.content,
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
    totalTokens: body.usage?.total_tokens ?? 0,
  };
};
