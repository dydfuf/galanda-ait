# RAON-193 Database boundary

> Historical record of the initial PostgreSQL boundary. The deferred work below
> describes that stage, not the current backlog. Use [ADR-001](adr/ADR-001-galanda-effect-v4-architecture.md)
> and the [staging runbook](staging-operations-runbook.md) for current implementation and operations.

The first PostgreSQL runtime uses Drizzle with `pg` (node-postgres) through Cloudflare Hyperdrive. Cloudflare documents `pg` as the recommended Hyperdrive driver, and Drizzle provides the `node-postgres` adapter. This keeps the Worker portable across PostgreSQL hosts while retaining transaction support for later repository work.

The current baseline stores one `TripRoom` aggregate per `trip_rooms` row. `revision` is an integer reserved for repository compare-and-set updates; domain transition policy remains outside this schema. Better Auth tables and the Drizzle repository are intentionally deferred.

Worker runtime configuration prefers the server-only `HYPERDRIVE.connectionString` binding and falls back to a server-only `DATABASE_URL`; no `VITE_*` variable is read. Current migration commands use `MIGRATION_DATABASE_URL`, as defined in [drizzle.config.ts](../drizzle.config.ts), separately from runtime credentials.
