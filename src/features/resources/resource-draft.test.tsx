// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { resourceDraftKey, useResourceDraft } from "./resource-draft.ts";
it("scopes private drafts by actor, trip and source, and clears on completion", () => {
  sessionStorage.clear();
  const initial = { url: "", note: "" };
  const own = resourceDraftKey("one", "trip", "source");
  const { result, unmount } = renderHook(() => useResourceDraft(own, initial));
  act(() => result.current.update({ url: "", note: "private draft", revision: 2 }));
  unmount();
  for (const key of [resourceDraftKey("two", "trip", "source"), resourceDraftKey("one", "other", "source"), resourceDraftKey("one", "trip", "other"), undefined]) {
    const other = renderHook(() => useResourceDraft(key, initial));
    expect(other.result.current.draft.note).toBe("");
    other.unmount();
  }
  const restored = renderHook(() => useResourceDraft(own, initial));
  expect(restored.result.current.draft).toEqual({ url: "", note: "private draft", revision: 2 });
  act(() => restored.result.current.clear());
  expect(sessionStorage.getItem(own!)).toBeNull();
});
