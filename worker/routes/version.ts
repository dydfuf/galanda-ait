import { Hono } from "hono";
import type { AppEnv } from "../app.ts";

export const versionRoute = new Hono<AppEnv>();

versionRoute.get("/", (c) => {
  const id = c.env?.CF_VERSION_METADATA?.id;
  // Publish only the platform-generated ID, never arbitrary tags or env values.
  const versionId = typeof id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
    ? id
    : null;
  c.header("Cache-Control", "no-store");
  return c.json({ worker: { versionId } });
});
