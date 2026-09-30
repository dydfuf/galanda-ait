import { describe, expect, it, vi } from "vitest";
import {
  OpenRouterCompletionError,
  readBoundedText,
  readOpenRouterCompletion,
  requestOpenRouter,
  type OpenRouterCompletionDiagnostics,
} from "./openrouter.ts";

const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
const tokenDiagnostics = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
const zeroTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
const choice = { finish_reason: "stop", message: { content: '{"places":[]}' } };

describe("OpenRouter binding transport", () => {
  it("uses Gateway BYOK without transmitting credentials and enables Gateway payload logs", async () => {
    const run = vi.fn<AiGateway["run"]>().mockResolvedValue(Response.json({}));
    const signal = AbortSignal.timeout(1000);
    await requestOpenRouter({ run }, {
      model: "test/model", instructions: "Extract supplied data", input: "untrusted note",
      schemaName: "test", schema: { type: "object" }, maxTokens: 50,
    }, signal, 1000);
    expect(run).toHaveBeenCalledWith({
      provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "cf-aig-collect-log-payload": "true" },
      query: {
        model: "test/model", max_tokens: 50,
        messages: [{ role: "system", content: "Extract supplied data" }, { role: "user", content: "untrusted note" }],
        response_format: { type: "json_schema", json_schema: { name: "test", strict: true, schema: { type: "object" } } },
        provider: { require_parameters: true, data_collection: "deny" },
      },
    }, {
      signal,
      extraHeaders: {
        "cf-aig-collect-log-payload": "true", "cf-aig-skip-cache": "true",
        "cf-aig-request-timeout": "1000", "cf-aig-max-attempts": "1",
      },
    });
  });
});

describe("OpenRouter completion validation", () => {
  it.each(["length", "content_filter", "tool_calls", "function_call", "error", null])("classifies unfinished completions and retains usage: %s", async (finish_reason) => {
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    await expect(readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason, message: { content: "" } }], usage,
    }), undefined, onDiagnostics)).rejects.toMatchObject({
      name: "OpenRouterCompletionError", failure: "FINISH_REASON",
      diagnostics: { ...tokenDiagnostics, finishReason: finish_reason ?? "OTHER", contentLength: 0 },
    });
    expect(onDiagnostics).toHaveBeenCalledExactlyOnceWith({
      ...tokenDiagnostics, finishReason: finish_reason ?? "OTHER", contentLength: 0, refusal: false, choiceCount: 1,
    });
  });

  it.each([
    { error: { code: 500 } },
    { choices: [] },
    { choices: [choice, choice] },
    { choices: [null] },
    { choices: [{ ...choice, finish_reason: 10 }] },
    { choices: [{ ...choice, message: {} }] },
    { choices: [{ ...choice, message: { content: [{ type: "text", text: "{}" }] } }] },
  ])("classifies invalid envelopes without losing valid usage %#", async (body) => {
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    await expect(readOpenRouterCompletion(Response.json({ ...body, usage }), undefined, onDiagnostics)).rejects.toMatchObject({
      failure: "ENVELOPE_SCHEMA", diagnostics: tokenDiagnostics,
    });
    expect(onDiagnostics).toHaveBeenCalledOnce();
    expect(onDiagnostics).toHaveBeenCalledWith(expect.objectContaining(tokenDiagnostics));
  });

  it.each([null, [], true, "provider text"])("rejects non-object envelopes %#", async (body) => {
    await expect(readOpenRouterCompletion(Response.json(body))).rejects.toMatchObject({
      failure: "ENVELOPE_SCHEMA", diagnostics: zeroTokens,
    });
  });

  it.each(["Cannot comply", "", false, 0, { reason: "private refusal text" }])("classifies every non-null refusal and retains usage %#", async (refusal) => {
    await expect(readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason: "stop", message: { content: null, refusal } }], usage,
    }))).rejects.toMatchObject({
      failure: "REFUSAL", diagnostics: { ...tokenDiagnostics, refusal: true, contentLength: 0 },
    });
  });

  it.each(["", " \n\t ", null])("rejects empty content and retains usage %#", async (content) => {
    await expect(readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason: "stop", message: { content } }], usage,
    }))).rejects.toMatchObject({
      failure: "EMPTY_CONTENT", diagnostics: { ...tokenDiagnostics, contentLength: content?.length ?? 0 },
    });
  });

  it("retains content and token usage for feature-specific validation", async () => {
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    expect(await readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason: "stop", message: { content: '  {"places":[]} \n', refusal: null } }], usage,
    }), undefined, onDiagnostics)).toEqual({ content: '  {"places":[]} \n', ...tokenDiagnostics });
    expect(onDiagnostics).toHaveBeenCalledExactlyOnceWith({
      ...tokenDiagnostics, finishReason: "stop", contentLength: 17, refusal: false, choiceCount: 1,
    });
  });

  it.each([undefined, null])("defaults absent usage to safe zero counts %#", async (usage) => {
    expect(await readOpenRouterCompletion(Response.json({ choices: [choice], usage }))).toEqual({
      content: choice.message.content, ...zeroTokens,
    });
  });

  it.each([[], "provider text", {}, { prompt_tokens: -1, completion_tokens: "5", total_tokens: 1.5 }])("still rejects malformed usage envelopes with safe diagnostics %#", async (usage) => {
    await expect(readOpenRouterCompletion(Response.json({ choices: [choice], usage }))).rejects.toMatchObject({
      failure: "ENVELOPE_SCHEMA", diagnostics: zeroTokens,
    });
  });

  it("sanitizes usage independently without discarding valid fields", async () => {
    expect(await readOpenRouterCompletion(Response.json({
      choices: [choice], usage: { prompt_tokens: Number.MAX_SAFE_INTEGER, completion_tokens: Number.MAX_SAFE_INTEGER + 1, total_tokens: 15 },
    }))).toEqual({ content: choice.message.content, inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 0, totalTokens: 15 });
    expect(await readOpenRouterCompletion(Response.json({
      choices: [choice], usage: { prompt_tokens: -1, completion_tokens: 1.5, total_tokens: 15 },
    }))).toEqual({ content: choice.message.content, inputTokens: 0, outputTokens: 0, totalTokens: 15 });
  });

  it("does not let a throwing or mutating diagnostics observer change validation", async () => {
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>((diagnostics) => {
      Object.assign(diagnostics, { inputTokens: -1, finishReason: "provider text" });
    });
    expect(await readOpenRouterCompletion(Response.json({ choices: [choice], usage }), undefined, onDiagnostics))
      .toEqual({ content: choice.message.content, ...tokenDiagnostics });
    await expect(readOpenRouterCompletion(Response.json({
      choices: [{ ...choice, finish_reason: "length" }], usage,
    }), undefined, onDiagnostics)).rejects.toMatchObject({ failure: "FINISH_REASON", diagnostics: tokenDiagnostics });
  });

  it("exposes only bounded safe metadata, never provider content or raw schema causes", async () => {
    const privateText = "synthetic-private-provider-payload";
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    const error: unknown = await readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason: privateText, message: { content: privateText, refusal: privateText, reasoning: privateText } }],
      usage: { ...usage, prompt_tokens: privateText }, provider: privateText,
    }), undefined, onDiagnostics).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(OpenRouterCompletionError);
    expect(error).toMatchObject({ failure: "ENVELOPE_SCHEMA", diagnostics: {
      inputTokens: 0, outputTokens: 5, totalTokens: 15,
      finishReason: "OTHER", contentLength: privateText.length, refusal: true, choiceCount: 1,
    } });
    expect(error).not.toHaveProperty("cause");
    expect(String(error)).not.toContain(privateText);
    expect(JSON.stringify(error)).not.toContain(privateText);
    expect(JSON.stringify(onDiagnostics.mock.calls)).not.toContain(privateText);

    const schemaError: unknown = await readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason: "stop", message: { content: { text: privateText } } }], usage,
    })).catch((error: unknown) => error);
    expect(schemaError).toMatchObject({ failure: "ENVELOPE_SCHEMA", diagnostics: tokenDiagnostics });
    expect(schemaError).not.toHaveProperty("cause");
    expect(String(schemaError)).not.toContain(privateText);
    expect(JSON.stringify(schemaError)).not.toContain(privateText);
  });

  it.each(["", '{"choices": synthetic-private-invalid-json}'])("classifies malformed JSON without retaining parser text %#", async (body) => {
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    const error: unknown = await readOpenRouterCompletion(new Response(body), undefined, onDiagnostics).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(OpenRouterCompletionError);
    expect(error).toMatchObject({ failure: "RESPONSE_JSON", diagnostics: zeroTokens });
    expect(error).not.toHaveProperty("cause");
    expect(String(error)).not.toContain("synthetic-private-invalid-json");
    expect(JSON.stringify(error)).not.toContain("synthetic-private-invalid-json");
    expect(onDiagnostics).toHaveBeenCalledExactlyOnceWith(zeroTokens);
  });

  it("bounds the provider body even after headers have arrived", async () => {
    const cancel = vi.fn<() => void>();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(150_001)); }, cancel });
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    await expect(readOpenRouterCompletion(new Response(stream), undefined, onDiagnostics)).rejects.toMatchObject({
      failure: "RESPONSE_TOO_LARGE", diagnostics: zeroTokens,
    });
    expect(onDiagnostics).toHaveBeenCalledExactlyOnceWith(zeroTokens);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("sanitizes body read failures without leaking a stream error or cause", async () => {
    const privateText = "synthetic-private-stream-error";
    const stream = new ReadableStream({ start(controller) { controller.error(new Error(privateText)); } });
    const error: unknown = await readOpenRouterCompletion(new Response(stream)).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(OpenRouterCompletionError);
    expect(error).toMatchObject({ failure: "RESPONSE_READ", diagnostics: zeroTokens });
    expect(error).not.toHaveProperty("cause");
    expect(String(error)).not.toContain(privateText);
    expect(JSON.stringify(error)).not.toContain(privateText);
  });

  it.each(["AbortError", "TimeoutError"])("preserves %s while reading without accepting a partial completion", async (name) => {
    const controller = new AbortController();
    const cancel = vi.fn<() => void>();
    const onDiagnostics = vi.fn<(diagnostics: OpenRouterCompletionDiagnostics) => void>();
    const stream = new ReadableStream({
      start(streamController) { streamController.enqueue(new TextEncoder().encode(JSON.stringify({ choices: [choice], usage }))); },
      cancel,
    });
    const reading = readOpenRouterCompletion(new Response(stream), controller.signal, onDiagnostics);
    const error = new DOMException("Timed out", name);
    controller.abort(error);
    await expect(reading).rejects.toBe(error);
    expect(onDiagnostics).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("preserves an already aborted signal", async () => {
    const error = new DOMException("Timed out", "TimeoutError");
    await expect(readOpenRouterCompletion(Response.json({ choices: [choice] }), AbortSignal.abort(error))).rejects.toBe(error);
  });
});

describe("bounded response reader", () => {
  it("keeps resource-reader oversized-body errors compatible", async () => {
    await expect(readBoundedText(new Response("oversized"), 5)).rejects.toThrow("Response too large");
  });

  it("counts UTF-8 bytes across chunks without damaging multibyte text", async () => {
    const bytes = new TextEncoder().encode("한글");
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(bytes.slice(0, 2));
      controller.enqueue(bytes.slice(2));
      controller.close();
    } });
    expect(await readBoundedText(new Response(stream), bytes.length)).toBe("한글");
    await expect(readBoundedText(new Response("한글"), bytes.length - 1)).rejects.toThrow("Response too large");
  });

  it("aborts a stalled response body without accepting partial output", async () => {
    const controller = new AbortController();
    const cancel = vi.fn<() => void>();
    const reading = readBoundedText(new Response(new ReadableStream({ cancel })), 150_000, controller.signal);
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await expect(reading).rejects.toMatchObject({ name: "TimeoutError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
