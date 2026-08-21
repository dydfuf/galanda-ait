# RAON-190 Oxlint compatibility note

`@tanstack/eslint-plugin-query@5.101.4` runs through Oxlint's JS plugin API for
`exhaustive-deps`, `stable-query-client`, and `no-unstable-deps`.

`no-void-query-fn` remains configured, but the official rule cannot execute in
Oxlint 1.79.0: its implementation requires ESLint parser services
(`context.sourceCode.parserServices.program` and `esTreeNodeToTSNodeMap`), while
Oxlint explicitly exposes an empty parser-services object to JS plugins.

The plugin also declares an optional TypeScript peer range ending at 6.x. The
repository pins npm's legacy peer resolution in `.npmrc` so `npm ci` remains
reproducible with the required TypeScript 7 compiler; the plugin does not use
that peer at runtime in Oxlint.

No ESLint/typescript-eslint sidecar was added. Revisit the npm exception and
this rule when the plugin supports TypeScript 7 and Oxlint exposes parser
services to JS plugins, or TanStack ships an Oxlint-compatible syntax-only
implementation.
