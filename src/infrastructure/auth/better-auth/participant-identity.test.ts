import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import type { DatabaseHandle } from "../../persistence/drizzle/database.ts";
import * as schema from "../../persistence/drizzle/schema/index.ts";
import {
  ensureParticipantIdentity,
  linkAnonymousParticipant,
} from "./participant-identity.ts";

const makeDatabase = (responses: ReadonlyArray<ReadonlyArray<unknown[]>>) => {
  const queue = [...responses];
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      calls.push({ text: config.text, params });
      return { rows: queue.shift() ?? [] };
    },
  };
  return {
    db: drizzle(client as unknown as NodePgClient, { schema }) as DatabaseHandle,
    calls,
  };
};

describe("Participant identity mapping", () => {
  it("returns the stable participant and every linked legacy identity", async () => {
    const { db } = makeDatabase([[['participant-guest']], [['participant-old']]]);

    await expect(ensureParticipantIdentity(db, "auth-user")).resolves.toEqual({
      participantId: "participant-guest",
      participantIds: ["participant-guest", "participant-old"],
    });
  });

  it("keeps the Guest participant canonical when linking an existing account", async () => {
    const { db, calls } = makeDatabase([
      [],
      [["participant-guest"]],
      [["participant-registered"]],
      [],
      [],
      [],
      [],
      [],
    ]);

    await linkAnonymousParticipant(db, "auth-guest", "auth-registered");

    expect(calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "begin",
      "select",
      "select",
      "update",
      "update",
      "insert",
      "update",
      "commit",
    ]);
    expect(calls[3]?.params).toContain("participant-registered");
    expect(calls[5]?.params).toEqual([
      "participant-registered",
      "participant-guest",
      "participant-guest",
    ]);
    expect(calls[6]?.params).toContain("auth-registered");
  });
});
