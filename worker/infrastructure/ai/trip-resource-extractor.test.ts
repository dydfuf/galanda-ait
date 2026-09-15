import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { makeTripResourceExtractor, readableResourceUrl, readResourcePage } from "./trip-resource-extractor.ts";
import { readBoundedText } from "./openrouter.ts";

const run = vi.fn<AiGateway["run"]>();
const config = { gateway: { run }, model: "test-model" };
const note = "성산일출봉은 제주 서귀포시에 있다. 일출을 보고 싶다.";
const place = { name: "성산일출봉", category: "SIGHT", location: "제주 서귀포시", summary: "일출을 보고 싶다는 멤버 의견", evidence: { source: "NOTE", text: "성산일출봉은 제주 서귀포시에 있다." } };
const response = (places: unknown[] = [place], status = "completed", linkUsable = false) => Response.json({
  choices: [{ finish_reason: status === "completed" ? "stop" : "length", message: { content: JSON.stringify({ linkUsable, places }) } }],
});
beforeEach(() => run.mockReset());

describe("resource source reader", () => {
  it("allows provider-owned travel/blog hosts and rejects arbitrary hosts, credentials and ports", () => {
    expect(readableResourceUrl("http://blog.naver.com/travel/123#text")?.href).toBe("https://m.blog.naver.com/travel/123");
    expect(readableResourceUrl("https://travel.tistory.com/1")?.hostname).toBe("travel.tistory.com");
    for (const value of ["http://127.0.0.1", "http://2130706433", "https://[::1]", "http://localhost", "https://metadata.google.internal", "https://booking.com.attacker.example", "https://user:secret@booking.com", "https://booking.com:8080", "file:///tmp/a", "https://unknown.example"]) {
      expect(readableResourceUrl(value)).toBeUndefined();
    }
  });
  it("does not follow a redirect into an unapproved/private destination", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    await expect(readResourcePage("https://www.booking.com/hotel", AbortSignal.timeout(1000), fetcher)).rejects.toThrow("Unsupported source or redirect");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });
  it("limits redirect chains", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/loop" } }));
    await expect(readResourcePage("https://www.booking.com/hotel", AbortSignal.timeout(1000), fetcher)).rejects.toThrow("Unsupported source or redirect");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("cancels an oversized streaming body without buffering the entire response", async () => {
    const cancel = vi.fn<() => void>();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10)); }, cancel });
    await expect(readBoundedText(new Response(stream), 5)).rejects.toThrow("Response too large");
    expect(cancel).toHaveBeenCalled();
  });
  it("rejects binary responses and reads bounded plain text", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("binary", { headers: { "content-type": "application/pdf" } })).mockResolvedValueOnce(new Response(note, { headers: { "content-type": "text/plain; charset=utf-8" } }));
    await expect(readResourcePage("https://travel.tistory.com/1", AbortSignal.timeout(1000), fetcher)).rejects.toThrow("Page unavailable");
    expect(await readResourcePage("https://travel.tistory.com/1", AbortSignal.timeout(1000), fetcher)).toBe(note);
  });
});

describe("resource place extraction", () => {
  it("uses supplied note text, validates evidence and preserves default reasoning", async () => {
    run.mockResolvedValue(response());
    const result = await Effect.runPromise(makeTripResourceExtractor(config).extract({ url: "", note }));
    expect(result).toEqual({ places: [place], linkStatus: "NOT_READ" });
    const request = run.mock.calls[0]![0] as AIGatewayUniversalRequest;
    expect(request.headers).toEqual({ "cf-aig-collect-log-payload": "true" });
    expect(request.provider).toBe("openrouter");
    expect(request.query).not.toHaveProperty("reasoning");
    const body = request.query as { messages: Array<{ content: string }>; tools?: unknown; response_format: { json_schema: { schema: { required: string[] } } } };
    expect(JSON.parse(body.messages[1]!.content)).toEqual({ LINK: "", NOTE: note });
    expect(body.tools).toBeUndefined();
    expect(body.response_format.json_schema.schema.required).toContain("linkUsable");
    expect(body.messages[0]!.content).toContain("When linkUsable is false, ignore LINK completely and extract only from NOTE.");
  });
  it("does not call an unconfigured provider", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const extractor = makeTripResourceExtractor({}, fetcher);
    expect(extractor.available).toBe(false);
    expect(await Effect.runPromise(extractor.extract({ url: "", note }).pipe(Effect.flip))).toMatchObject({ reason: "UNAVAILABLE" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
  it("does not infer places from a URL that could not be read", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await Effect.runPromise(makeTripResourceExtractor(config, fetcher).extract({ url: "https://unknown.example/hotel", note: "" }).pipe(Effect.flip))).toMatchObject({ reason: "SOURCE_UNREADABLE" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
  it("explicitly reports an unread link when using only the note", async () => {
    run.mockResolvedValue(response());
    const result = await Effect.runPromise(makeTripResourceExtractor(config).extract({ url: "https://unknown.example/hotel", note }));
    expect(result.linkStatus).toBe("UNAVAILABLE");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("extracts a place from link text with LINK provenance", async () => {
    const fromLink = { ...place, evidence: { ...place.evidence, source: "LINK" } };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(note, { headers: { "content-type": "text/plain" } }));
    run.mockResolvedValue(response([fromLink], "completed", true));
    const result = await Effect.runPromise(makeTripResourceExtractor(config, fetcher).extract({ url: "https://travel.tistory.com/1", note: "" }));
    expect(result).toMatchObject({ linkStatus: "READ", places: [fromLink] });
  });
  it.each(["로그인이 필요합니다", "Verify you are human to continue", "홈 · 숙소 검색 · 예약 관리"])("does not complete an HTTP 200 unreadable page as no places: %s", async (page) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(page, { headers: { "content-type": "text/plain" } }));
    run.mockResolvedValue(response([]));
    const result = await Effect.runPromise(makeTripResourceExtractor(config, fetcher).extract({ url: "https://www.booking.com/hotel", note: "" }).pipe(Effect.flip));
    expect(result).toMatchObject({ reason: "SOURCE_UNREADABLE" });
  });
  it("uses only note evidence when the model identifies an unreadable link", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("로그인이 필요합니다", { headers: { "content-type": "text/plain" } }));
    run.mockResolvedValue(response());
    expect(await Effect.runPromise(makeTripResourceExtractor(config, fetcher).extract({ url: "https://www.booking.com/hotel", note })))
      .toEqual({ places: [place], linkStatus: "UNAVAILABLE" });
  });
  it("rejects LINK evidence from content classified as unreadable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(`${note} 로그인 필요`, { headers: { "content-type": "text/plain" } }));
    run.mockResolvedValue(response([{ ...place, evidence: { ...place.evidence, source: "LINK" } }]));
    expect(await Effect.runPromise(makeTripResourceExtractor(config, fetcher).extract({ url: "https://www.booking.com/hotel", note }).pipe(Effect.flip)))
      .toMatchObject({ reason: "INVALID_OUTPUT" });
  });
  it("keeps readable content without named places distinct from unreadable content", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("여행할 때는 편한 신발과 가벼운 짐을 준비하세요.", { headers: { "content-type": "text/plain" } }));
    run.mockResolvedValue(response([], "completed", true));
    expect(await Effect.runPromise(makeTripResourceExtractor(config, fetcher).extract({ url: "https://travel.tistory.com/1", note: "" })))
      .toEqual({ places: [], linkStatus: "READ" });
  });
  it("does not accept a usable LINK flag when no LINK was supplied", async () => {
    run.mockResolvedValue(response([place], "completed", true));
    expect(await Effect.runPromise(makeTripResourceExtractor(config).extract({ url: "", note }).pipe(Effect.flip)))
      .toMatchObject({ reason: "INVALID_OUTPUT" });
  });
  it("requires an explicit link usability decision in the model output", async () => {
    run.mockResolvedValue(Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ places: [] }) } }],
    }));
    expect(await Effect.runPromise(makeTripResourceExtractor(config).extract({ url: "", note }).pipe(Effect.flip)))
      .toMatchObject({ reason: "INVALID_OUTPUT" });
  });
  it.each([
    { ...place, name: "없는 장소" },
    { ...place, location: "추측한 주소" },
    { ...place, evidence: { source: "NOTE", text: "원문에 없는 근거" } },
    { ...place, evidence: { source: "LINK", text: place.evidence.text } },
    { ...place, category: "INVENTED" },
    { ...place, summary: "a".repeat(701) },
  ])("rejects ungrounded or invalid model output %#", async (invalid) => {
    run.mockResolvedValue(response([invalid]));
    expect(await Effect.runPromise(makeTripResourceExtractor(config).extract({ url: "", note }).pipe(Effect.flip))).toMatchObject({ reason: "INVALID_OUTPUT" });
  });
  it("distinguishes no named places from an incomplete provider response", async () => {
    run.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([place], "incomplete"));
    const extractor = makeTripResourceExtractor(config);
    expect(await Effect.runPromise(extractor.extract({ url: "", note }))).toMatchObject({ places: [] });
    expect(await Effect.runPromise(extractor.extract({ url: "", note }).pipe(Effect.flip))).toMatchObject({ reason: "INVALID_OUTPUT" });
  });
  it("rejects a card that combines one place name with another place's evidence", async () => {
    run.mockResolvedValue(response([{ ...place, name: "경복궁" }]));
    expect(await Effect.runPromise(makeTripResourceExtractor(config).extract({
      url: "", note: `경복궁은 서울 종로구에 있다. ${note}`,
    }).pipe(Effect.flip))).toMatchObject({ reason: "INVALID_OUTPUT" });
  });
});
