import { Context } from "effect";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema/index.ts";

export type DatabaseHandle = NodePgDatabase<typeof schema>;

/** Infrastructure-only database handle shared by future auth and repository adapters. */
export class Database extends Context.Service<
  Database,
  { readonly db: DatabaseHandle }
>()("galanda/infrastructure/Database") {}
