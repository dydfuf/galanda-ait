# Agent Instructions

## Vendored repositories

`repos/` contains third-party source vendored for agent reference.

- Treat it as read-only reference material, not application code.
- Do not import from or edit files under `repos/`.
- When working with an associated dependency, prefer its vendored implementation and tests over web search or generated API guesses.

## Effect

When writing or reviewing code that imports `effect`, inspect the relevant implementation and tests under `repos/effect/packages/effect/` first. The subtree is pinned to the same version as the `effect` dependency; keep both versions aligned when updating.
