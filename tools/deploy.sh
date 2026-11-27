#!/usr/bin/env bash
# lumen8.ai release with the local test gate (CORE-27; GitHub Actions is not used for testing, owner decision D13).
#
#   tools/deploy.sh site     push main to GitHub (GitHub Pages serves lumen8.ai from main)
#   tools/deploy.sh edge     deploy the lead Worker (_edge/, route lumen8.ai/api/*)
#   tools/deploy.sh all      both
#
# Gate, on a clean `git archive` of HEAD (so only committed files are tested and shipped):
#   1. tracked files are clean and HEAD contains origin/main (no lost commits from other sessions)
#   2. python tools/check.py   (canonicals, links, sitemap, legal set, brand sweep, generated pages current)
#   3. node --check on every top-level .js file and the Worker; node --test _edge/worker.test.mjs
# Any failure stops before anything ships (exit 3). There is no override that skips the tests.
# Env: WRANGLER (default npx --yes wrangler@^4.151.0), PYTHON.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
WHAT="${1:-}"
case "$WHAT" in site|edge|all) ;; *) sed -n '2,16p' "$0"; exit 2 ;; esac
PY="${PYTHON:-$(command -v python3 >/dev/null 2>&1 && echo python3 || echo python)}"
WRANGLER="${WRANGLER:-npx --yes wrangler@^4.151.0}"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo "deploy: uncommitted changes to tracked files"; exit 3; fi
git fetch -q origin main
if ! git merge-base --is-ancestor origin/main HEAD; then echo "deploy: HEAD lacks origin/main; rebase first"; exit 3; fi

SHA="$(git rev-parse --short=12 HEAD)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive --format=tar HEAD | tar -x -C "$TMP"
echo "gate: testing $SHA in $TMP"
( cd "$TMP"
  "$PY" -I tools/check.py
  for f in *.js _edge/worker.js; do node --check "$f"; done
  node --test --test-reporter=dot _edge/worker.test.mjs
) || { echo "gate: FAILED, nothing shipped"; exit 3; }
echo "gate: passed for $SHA"

if [ "$WHAT" = site ] || [ "$WHAT" = all ]; then
  git push origin HEAD:main
  echo "deploy: main -> $SHA pushed (GitHub Pages builds in about a minute)"
fi
if [ "$WHAT" = edge ] || [ "$WHAT" = all ]; then
  grep -q REPLACE_AT_CREATE "$TMP/_edge/wrangler.jsonc" && { echo "deploy: create the D1 database first (see _edge/README.md)"; exit 3; }
  (cd "$TMP/_edge" && $WRANGLER deploy)
  echo "deploy: lumen8-site-edge live from $SHA"
fi
