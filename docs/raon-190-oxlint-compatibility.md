# RAON-190 TanStack Query lint follow-up

@tanstack/eslint-plugin-query is intentionally deferred from this PR. The
current release declares a TypeScript peer range ending at 6.x, and its
no-void-query-fn implementation requires ESLint parser services that Oxlint
JS plugins do not expose.

Revisit the Query rules after official TypeScript 7 and Oxlint compatibility is
available. Do not restore legacy-peer-deps or add an ESLint sidecar as a
workaround.
