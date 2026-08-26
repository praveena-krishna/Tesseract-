#!/usr/bin/env bash
# Guards the two GLSL traps that TypeScript cannot see and that fail silently.
#
# 1. A backtick anywhere inside shader source or its comments terminates the
#    template literal the shader is written in. The file may still parse, and
#    what reaches the GPU is then truncated nonsense.
# 2. A GLSL reserved word used as a variable name fails the whole program to
#    compile. A material whose shader will not compile draws nothing at all
#    rather than raising anything, so the symptom is an empty screen.
#
# Reports on stdout as hook JSON. Never blocks — it tells you and lets you look.
set -uo pipefail

file="${1:-}"
case "$file" in
  *.glsl.ts) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

problems=""

# Backticks that are not the literal's own delimiters. The delimiters in this
# codebase are a line ending `/* glsl */ ` + backtick, or a lone backtick and
# semicolon closing it.
stray=$(grep -nF '`' "$file" \
  | grep -vE '/\* glsl \*/ `$' \
  | grep -vE '^[0-9]+:\s*`;?\s*$' || true)
if [ -n "$stray" ]; then
  problems+="Backtick inside shader source — this ends the template literal early:
$stray
"
fi

# Reserved words used as identifiers.
reserved='half|input|output|long|short|double|fixed|cast|namespace|using|this|packed|goto|inline|volatile|public|static|extern|external|interface|flat|filter|sizeof|union|enum|typedef|template|asm|class|common|partition|active|superp'
bad=$(grep -nE "\b(vec[234]|float|int|bool|mat[234]|ivec[234]|bvec[234])[[:space:]]+($reserved)[[:space:]]*[=;(]" "$file" || true)
if [ -n "$bad" ]; then
  problems+="GLSL reserved word used as a variable name — the shader will not compile and will draw nothing:
$bad
"
fi

# Varyings, checked per shader block rather than per file.
#
# Two failures, both of which stop the program compiling: the same varying
# declared twice inside one stage, and a varying used in a stage that never
# declares it. A material whose shader will not compile draws nothing rather
# than raising anything, so the symptom is the halos rendering and the solid
# geometry silently missing. This has cost three sessions; it is cheaper to
# check than to rediscover.
#
# Blocks are delimited the way this codebase writes them: a line ending in
# `/* glsl */` plus a backtick opens one, a lone backtick and semicolon closes
# it. Varyings here are named vCamelCase, which is what the usage scan keys on.
varyings=$(awk '
  /\/\* glsl \*\/ `$/ { inblock = 1; delete declared; delete used; block++; next }
  /^[[:space:]]*`;?[[:space:]]*$/ {
    if (inblock) {
      for (name in declared)
        if (declared[name] > 1) print "declared " declared[name] " times in one stage: " name
      for (name in used)
        if (!(name in declared)) print "used but never declared in that stage: " name
    }
    inblock = 0; next
  }
  inblock {
    if (match($0, /varying[[:space:]]+[A-Za-z0-9_]+[[:space:]]+v[A-Za-z0-9_]+/)) {
      decl = substr($0, RSTART, RLENGTH)
      sub(/.*[[:space:]]/, "", decl)
      declared[decl]++
      next
    }
    # Not \b — mawk does not support it, and the check silently found nothing.
    line = $0
    while (match(line, /(^|[^A-Za-z0-9_])v[A-Z][A-Za-z0-9_]*/)) {
      name = substr(line, RSTART, RLENGTH)
      sub(/^[^A-Za-z0-9_]/, "", name)
      used[name] = 1
      line = substr(line, RSTART + RLENGTH)
    }
  }
' "$file" || true)
if [ -n "$varyings" ]; then
  problems+="Varying problem — the shader will not compile and will draw nothing:
$varyings
"
fi

[ -z "$problems" ] && exit 0

printf '%s' "$problems" | jq -Rs --arg f "$file" '{
  systemMessage: ("GLSL guard: problems in " + $f),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("GLSL guard flagged " + $f + ":\n" + .)
  }
}'
