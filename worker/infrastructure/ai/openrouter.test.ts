import { describe, expect, it, vi } from "vitest";
import { readBoundedText, readOpenRouterCompletion, requestOpenRouter } from "./openrouter.ts";

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

  it.each(["length", "content_filter", "tool_calls", "error", null])("rejects unfinished/refused completions: %s", async (finish_reason) => {
    await expect(readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason, message: { content: '{"places":[]}' } }],
    }))).rejects.toThrow(/Expected|Missing/);
  });

  it.each([
    { error: { code: 500 } },
    { choices: [] },
    { choices: [{ finish_reason: "stop", message: { content: "" } }] },
    { choices: [{ finish_reason: "stop", message: { content: "{}", refusal: "Cannot comply" } }] },
  ])("rejects invalid completion envelopes %#", async (body) => {
    await expect(readOpenRouterCompletion(Response.json(body))).rejects.toThrow(/Expected|Missing/);
  });

  it("retains content and token usage for feature-specific validation", async () => {
    expect(await readOpenRouterCompletion(Response.json({
      choices: [{ finish_reason: "stop", message: { content: '{"places":[]}', refusal: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }))).toEqual({ content: '{"places":[]}', inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it("bounds the provider body even after headers have arrived", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(150_001)); }, cancel });
    await expect(readOpenRouterCompletion(new Response(stream))).rejects.toThrow("Response too large");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("aborts a stalled response body without accepting partial output", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const reading = readBoundedText(new Response(new ReadableStream({ cancel })), 150_000, controller.signal);
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await expect(reading).rejects.toMatchObject({ name: "TimeoutError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
