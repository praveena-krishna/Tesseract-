#!/usr/bin/env bash
# Lints just the file that was edited, and reports errors only.
#
# Warnings are deliberately dropped. This project mutates refs and buffers
# inside useFrame by design — that is the documented convention, and it trips
# oxlint's react(immutability) warning on every frame-loop file. Surfacing those
# on each edit would be noise around a decision that was made on purpose.
# Errors, chiefly rules-of-hooks, are real and worth interrupting for.
set -uo pipefail

file="${1:-}"
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
[ -x ./node_modules/.bin/oxlint ] || exit 0

found=$(./node_modules/.bin/oxlint "$file" 2>&1 | grep -E ': error ' || true)
[ -z "$found" ] && exit 0

printf '%s' "$found" | jq -Rs --arg f "$file" '{
  systemMessage: ("oxlint: errors in " + $f),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("oxlint reported errors in " + $f + ":\n" + .)
  }
}'
