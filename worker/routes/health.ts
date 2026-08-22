import { Hono } from "hono";
import type { AppEnv } from "../app.ts";

export const healthRoute = new Hono<AppEnv>();

healthRoute.get("/", (c) => {
  return c.json({ ok: true });
});
