import { useState } from "react";

interface ResourceDraft { url: string; note: string; revision?: number }
const read = (key: string | undefined): ResourceDraft | undefined => {
  if (!key) return;
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return;
    const draft = value as Partial<ResourceDraft>;
    if (typeof draft.url !== "string" || draft.url.length > 2048 || typeof draft.note !== "string" || draft.note.length > 20_000) return;
    if (draft.revision !== undefined && (!Number.isInteger(draft.revision) || draft.revision < 1)) return;
    return draft as ResourceDraft;
  } catch { return; }
};

export const resourceDraftKey = (actor: string | undefined, trip: string, resource = "new") =>
  actor ? `galanda:resource-draft:${encodeURIComponent(actor)}:${encodeURIComponent(trip)}:${encodeURIComponent(resource)}` : undefined;

/** This tab only, scoped to authenticated participant and trip. Never stores credentials. */
export function useResourceDraft(key: string | undefined, initial: ResourceDraft) {
  const [draft, setDraft] = useState(() => read(key) ?? initial);
  const [saved, setSaved] = useState(false);
  const update = (next: ResourceDraft) => {
    setDraft(next);
    try {
      if (!key) { setSaved(false); return; }
      sessionStorage.setItem(key, JSON.stringify(next));
      setSaved(true);
    } catch { setSaved(false); }
  };
  const clear = () => {
    try { if (key) sessionStorage.removeItem(key); } catch { /* Current input is still usable. */ }
    setSaved(false);
  };
  return { draft, update, clear, saved };
}
