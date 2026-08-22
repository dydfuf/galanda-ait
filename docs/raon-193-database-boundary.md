# RAON-193 Database boundary

The first PostgreSQL runtime uses Drizzle with `pg` (node-postgres) through Cloudflare Hyperdrive. Cloudflare documents `pg` as the recommended Hyperdrive driver, and Drizzle provides the `node-postgres` adapter. This keeps the Worker portable across PostgreSQL hosts while retaining transaction support for later repository work.

The current baseline stores one `TripRoom` aggregate per `trip_rooms` row. `revision` is an integer reserved for repository compare-and-set updates; domain transition policy remains outside this schema. Better Auth tables and the Drizzle repository are intentionally deferred.

Worker runtime configuration prefers the server-only `HYPERDRIVE.connectionString` binding and falls back to a server-only `DATABASE_URL`. Local migration commands use `DATABASE_URL`; no `VITE_*` variable is read.
