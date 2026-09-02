#!/usr/bin/env bash
set -euo pipefail

# Deterministic drift check: verifies that `drizzle` migrations are in sync with current schema.
# No DB credentials required (uses drizzle-kit generate which is schema+snapshot based).
# Fails if `drizzle-kit generate` would create a new migration, indicating missing migration.

echo "▶ checking for missing Drizzle migrations (no DB required)..."

# Ensure we are in git repo; capture initial drizzle state
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository, skipping git diff check and relying on generate output"
  npx drizzle-kit generate --name _ci_drift_check > /tmp/drizzle-generate.log 2>&1 || true
  cat /tmp/drizzle-generate.log
  if grep -q "No schema changes" /tmp/drizzle-generate.log; then
    echo "✅ No Drizzle drift (No schema changes)"
    exit 0
  else
    echo "❌ Drizzle schema drift detected - migration is missing."
   echo "Run 'pnpm db:generate' locally and commit the new migration."
    exit 1
   fi
fi

BEFORE=$(git status --porcelain -- drizzle || true)

# Run generate with a temporary name; if schema is in sync, no file is created.
npx drizzle-kit generate --name _ci_drift_check > /tmp/drizzle-generate.log 2>&1 || true
cat /tmp/drizzle-generate.log

# Check git status for drizzle folder - any change means drift
AFTER=$(git status --porcelain -- drizzle || true)

if [ "$BEFORE" != "$AFTER" ]; then
  echo ""
  echo "❌ Drizzle schema drift detected - migration is missing or drizzle metadata is out of sync."
  echo "Run 'pnpm db:generate' locally and commit the new migration."
  echo ""
  echo "git status --porcelain -- drizzle:"
  echo "$AFTER"
  echo ""
  echo "git diff -- drizzle (first 200 lines):"
  git diff -- drizzle | head -n 200 || true
  echo ""
  echo "Cleaning up temporary generated files..."
  # Restore journal if modified
  git checkout -- drizzle/meta/_journal.json 2>/dev/null || true
  # Remove untracked generated files (new .sql and snapshot)
  git clean -fd -- drizzle 2>/dev/null || true
  # Fallback explicit removal for _ci_drift_check artifacts
  rm -f drizzle/*_ci_drift_check*.sql drizzle/meta/*_ci_drift_check*.json 2>/dev/null || true
  # Ensure no leftover 0002+ files if they were generated (in case git clean didn't run due to .gitignore)
  # Re-check status and clean again
  git status --porcelain -- drizzle || true
  exit 1
fi

# Success path: no drift. Ensure journal not inadvertently modified (shouldn't be)
git checkout -- drizzle/meta/_journal.json 2>/dev/null || true
echo "✅ Drizzle schema and migrations are in sync (no drift)"
