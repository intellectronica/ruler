#!/usr/bin/env bash

# Functional test for Ruler (TypeScript and Rust ports)
# - Creates a temp project
# - Initializes .ruler with rule files, ruler.toml, mcp.json
# - Runs Ruler apply for a subset of agents and verifies outputs
# - Runs Ruler revert and verifies cleanup
# - If a Rust binary is available, repeats the same checks for Rust

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TS_RUNNER=(node "$REPO_ROOT/dist/cli/index.js")
RUST_BIN="$REPO_ROOT/rust/target/debug/ruler-rs"
RUST_BIN_FALLBACK="$REPO_ROOT/rust/ruler-rs/target/debug/ruler-rs"

function msg() { printf "[functional-test] %s\n" "$*"; }
function err() { printf "[functional-test:ERROR] %s\n" "$*" >&2; }

function make_tmpdir() {
  local dir
  dir="$(mktemp -d 2>/dev/null || mktemp -d -t ruler-func)"
  echo "$dir"
}

function write_ruler_config() {
  local proj="$1"
  mkdir -p "$proj/.ruler/sub"
  cat >"$proj/.ruler/one.md" <<'EOF'
# One

Alpha
EOF
  cat >"$proj/.ruler/sub/two.md" <<'EOF'
# Two

Beta
EOF
  cat >"$proj/.ruler/ruler.toml" <<'EOF'
default_agents = ["copilot", "claude", "cursor", "aider"]

[agents.copilot]
enabled = true

[agents.claude]
enabled = true

[agents.cursor]
enabled = true

[agents.aider]
enabled = true

[gitignore]
enabled = true
EOF
  cat >"$proj/.ruler/mcp.json" <<'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
EOF
}

function relpath() {
  # relpath <target> <base>
  python3 - "$1" "$2" <<'PY'
import os, sys
target = sys.argv[1]
base = sys.argv[2]
print(os.path.relpath(target, base))
PY
}

function expected_concat() {
  # Build the expected concatenation relative to REPO_ROOT (matches TS cwd behavior here)
  local proj="$1"
  local one_abs="$proj/.ruler/one.md"
  local two_abs="$proj/.ruler/sub/two.md"
  local one_rel
  local two_rel
  one_rel="$(relpath "$one_abs" "$REPO_ROOT")"
  two_rel="$(relpath "$two_abs" "$REPO_ROOT")"
  cat <<EOF
---
Source: ${one_rel}
---
# One

Alpha

---
Source: ${two_rel}
---
# Two

Beta

EOF
}

function run_apply_and_verify() {
  local runner_desc="$1"; shift
  local -a runner=("$@")

  local proj
  proj="$(make_tmpdir)"
  trap 'rm -rf "$proj"' EXIT
  msg "Created temp project: $proj"

  (cd "$proj" && write_ruler_config "$proj")

  msg "Running apply ($runner_desc)"
  # Run from REPO_ROOT to match process.cwd() used by TS for Source headers
  (cd "$REPO_ROOT" && "${runner[@]}" apply --agents copilot,claude,cursor,aider --project-root "$proj")

  # Expected concatenation
  local expected
  expected="$(expected_concat "$proj")"

  # Check Copilot
  local copilot_path="$proj/.github/copilot-instructions.md"
  test -f "$copilot_path" || { err "Missing $copilot_path"; return 1; }
  diff -u <(printf "%s\n" "$expected") "$copilot_path"

  # Check Claude
  local claude_path="$proj/CLAUDE.md"
  test -f "$claude_path" || { err "Missing $claude_path"; return 1; }
  diff -u <(printf "%s\n" "$expected") "$claude_path"

  # Check Cursor (front-matter + expected)
  local cursor_path="$proj/.cursor/rules/ruler_cursor_instructions.mdc"
  test -f "$cursor_path" || { err "Missing $cursor_path"; return 1; }
  local front='---
alwaysApply: true
---
'
  diff -u <(printf "%s%s\n" "$front" "$expected") "$cursor_path"

  # Check Aider instruction and config YAML contains read entry
  local aider_md="$proj/ruler_aider_instructions.md"
  local aider_cfg="$proj/.aider.conf.yml"
  test -f "$aider_md" || { err "Missing $aider_md"; return 1; }
  diff -u <(printf "%s\n" "$expected") "$aider_md"
  test -f "$aider_cfg" || { err "Missing $aider_cfg"; return 1; }
  grep -q "ruler_aider_instructions.md" "$aider_cfg" || { err "Aider config missing read entry"; return 1; }

  # Check .gitignore has a Ruler block and includes expected paths
  local gi="$proj/.gitignore"
  test -f "$gi" || { err "Missing .gitignore"; return 1; }
  grep -q "^# START Ruler Generated Files$" "$gi" || { err "Missing start marker in .gitignore"; return 1; }
  grep -q "^# END Ruler Generated Files$" "$gi" || { err "Missing end marker in .gitignore"; return 1; }
  grep -q "^\.github/copilot-instructions.md$" "$gi" || { err "copilot path not listed in .gitignore"; return 1; }
  grep -q "^CLAUDE.md$" "$gi" || { err "claude path not listed in .gitignore"; return 1; }
  grep -q "^\.cursor/rules/ruler_cursor_instructions.mdc$" "$gi" || { err "cursor path not listed in .gitignore"; return 1; }
  grep -q "^ruler_aider_instructions.md$" "$gi" || { err "aider md not listed in .gitignore"; return 1; }
  grep -q "^\.aider\.conf\.yml$" "$gi" || { err "aider config not listed in .gitignore"; return 1; }
  grep -q "^\*\.bak$" "$gi" || { err "*.bak not listed in .gitignore"; return 1; }

  # Now revert and verify cleanup
  msg "Running revert ($runner_desc)"
  (cd "$REPO_ROOT" && "${runner[@]}" revert --agents copilot,claude,cursor,aider --project-root "$proj")

  # Outputs should be removed or restored from backups; for this functional test we didn't create backups, so files should be gone
  for p in \
    "$copilot_path" \
    "$claude_path" \
    "$cursor_path" \
    "$aider_md" \
    "$aider_cfg"; do
    if [[ -e "$p" ]]; then
      err "Expected removal after revert: $p"
      return 1
    fi
  done

  # Note: TS revert only cleans .gitignore when not filtering by agents; we passed --agents,
  # so we don't assert on .gitignore cleanup here.

  # Empty directories created by Ruler should be removed if empty
  [[ ! -d "$proj/.github" ]] || { err ".github not removed"; return 1; }
  [[ ! -d "$proj/.cursor" ]] || { err ".cursor not removed"; return 1; }
  [[ ! -d "$proj/.aider" ]] || { err ".aider dir should not exist (we only created .aider.conf.yml at root)"; return 1; }

  # Cleanup handled by trap
  trap - EXIT
  rm -rf "$proj"
  msg "OK ($runner_desc)"
}

function main() {
  local mode="both"
  if [[ "${1:-}" == "--mode" && -n "${2:-}" ]]; then
    mode="$2"; shift 2
  fi

  # TypeScript first
  if [[ "$mode" == "both" || "$mode" == "ts" ]]; then
    # Ensure TS build exists
    if [[ ! -f "$REPO_ROOT/dist/cli/index.js" ]]; then
      msg "Building TypeScript dist..."
      (cd "$REPO_ROOT" && npm run --silent build)
    fi
    run_apply_and_verify "TypeScript" "${TS_RUNNER[@]}"
  fi

  # Rust (optional)
  if [[ "$mode" == "both" || "$mode" == "rust" ]]; then
    if [[ -x "$RUST_BIN" ]]; then
      run_apply_and_verify "Rust" "$RUST_BIN"
    elif [[ -x "$RUST_BIN_FALLBACK" ]]; then
      run_apply_and_verify "Rust" "$RUST_BIN_FALLBACK"
    else
      msg "Rust binary not found at $RUST_BIN — skipping Rust run."
    fi
  fi
}

main "$@"
#!/usr/bin/env bash
set -euo pipefail

# Functional test for Ruler CLI.
# Validates TypeScript implementation now; later reuses the same checks for the Rust port.
#
# Usage:
#   scripts/functional_test.sh ts   # run tests using Node/TypeScript dist
#   scripts/functional_test.sh rust # run tests using rust binary at rust/target/release/ruler-rs (or RUST_BIN env)

MODE="${1:-ts}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_CLI="${REPO_ROOT}/dist/cli/index.js"
RUST_BIN_DEFAULT="${REPO_ROOT}/rust/ruler-rs/target/release/ruler-rs"
RUST_BIN="${RUST_BIN:-$RUST_BIN_DEFAULT}"

function log() { echo "[functional] $*"; }
function fail() { echo "[functional:ERROR] $*" >&2; exit 1; }

TMPDIR_ROOT="${TMPDIR:-/tmp}"
WORKDIR="$(mktemp -d "${TMPDIR_ROOT%/}/ruler-func-XXXXXX")"
trap 'rm -rf "${WORKDIR}"' EXIT

log "Workdir: ${WORKDIR}"
cd "${WORKDIR}"

# 1) Prepare a small project with .ruler
mkdir -p .ruler/subdir
cat > .ruler/a.md <<'EOF'
A content
EOF
cat > .ruler/subdir/b.md <<'EOF'
B content
EOF
cat > .ruler/ruler.toml <<'EOF'
default_agents = ["copilot","claude","cursor","aider"]

[mcp]
enabled = true
merge_strategy = "merge"

[gitignore]
enabled = true

[agents.copilot]
enabled = true

[agents.claude]
enabled = true

[agents.cursor]
enabled = true

[agents.aider]
enabled = true
EOF
cat > .ruler/mcp.json <<'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y","@modelcontextprotocol/server-filesystem","/path/to/project"]
    },
    "git": {
      "command": "npx",
      "args": ["-y","@modelcontextprotocol/server-git","--repository","."]
    }
  }
}
EOF

EXPECTED_RULES=$(printf "%s\n" "---
Source: .ruler/a.md
---
A content

---
Source: .ruler/subdir/b.md
---
B content")

EXPECTED_CURSOR=$(printf "%s\n" "---
alwaysApply: true
---
---
Source: .ruler/a.md
---
A content

---
Source: .ruler/subdir/b.md
---
B content")

run_cli_apply() {
  case "$MODE" in
    ts)
      node "${DIST_CLI}" apply --project-root "${WORKDIR}" --verbose || return 1 ;;
    rust)
      "${RUST_BIN}" apply --project-root "${WORKDIR}" --verbose || return 1 ;;
    *)
      fail "Unknown MODE: ${MODE}" ;;
  esac
}

run_cli_revert() {
  case "$MODE" in
    ts)
      node "${DIST_CLI}" revert --project-root "${WORKDIR}" --verbose || return 1 ;;
    rust)
      "${RUST_BIN}" revert --project-root "${WORKDIR}" --verbose || return 1 ;;
    *)
      fail "Unknown MODE: ${MODE}" ;;
  esac
}

# 2) Run apply
log "Running apply (${MODE})"
run_cli_apply

# 3) Verify outputs
test -f ".github/copilot-instructions.md" || fail "Missing copilot output"
test -f "CLAUDE.md" || fail "Missing CLAUDE.md"
test -f ".cursor/rules/ruler_cursor_instructions.mdc" || fail "Missing Cursor output"
test -f "ruler_aider_instructions.md" || fail "Missing Aider instructions"
test -f ".aider.conf.yml" || fail "Missing Aider YAML config"

# Normalize Source: paths to canonical .ruler/... before diffing
normalize() {
  # Usage: normalize <file|-> ; if '-' read stdin
  python3 - "$1" <<'PY'
import re, sys
p = sys.argv[1]
if p == '-':
  s = sys.stdin.read()
else:
  with open(p, 'r', encoding='utf-8') as f:
    s = f.read()
s = re.sub(r"^Source: .*?(/?\.ruler/a\.md)$", r"Source: .ruler/a.md", s, flags=re.M)
s = re.sub(r"^Source: .*?(/?\.ruler/subdir/b\.md)$", r"Source: .ruler/subdir/b.md", s, flags=re.M)
if s.endswith('\n'):
  s = s[:-1]
sys.stdout.write(s)
PY
}

# Content checks for Copilot + Claude (verify structure and key content)
N_ACTUAL_COPILOT=$(normalize ".github/copilot-instructions.md")
N_ACTUAL_CLAUDE=$(normalize "CLAUDE.md")

printf "%s" "$N_ACTUAL_COPILOT" | grep -q '^---$' || fail "Copilot missing section delimiter"
printf "%s" "$N_ACTUAL_COPILOT" | grep -F -q 'Source: .ruler/a.md' || fail "Copilot missing Source a.md"
printf "%s" "$N_ACTUAL_COPILOT" | grep -F -q 'Source: .ruler/subdir/b.md' || fail "Copilot missing Source subdir/b.md"
printf "%s" "$N_ACTUAL_COPILOT" | grep -q '^A content$' || fail "Copilot missing A content"
printf "%s" "$N_ACTUAL_COPILOT" | grep -q '^B content$' || fail "Copilot missing B content"

printf "%s" "$N_ACTUAL_CLAUDE" | grep -q '^---$' || fail "Claude missing section delimiter"
printf "%s" "$N_ACTUAL_CLAUDE" | grep -F -q 'Source: .ruler/a.md' || fail "Claude missing Source a.md"
printf "%s" "$N_ACTUAL_CLAUDE" | grep -F -q 'Source: .ruler/subdir/b.md' || fail "Claude missing Source subdir/b.md"
printf "%s" "$N_ACTUAL_CLAUDE" | grep -q '^A content$' || fail "Claude missing A content"
printf "%s" "$N_ACTUAL_CLAUDE" | grep -q '^B content$' || fail "Claude missing B content"

# Cursor content check (front-matter + rules)
N_ACTUAL_CURSOR=$(normalize ".cursor/rules/ruler_cursor_instructions.mdc")
printf "%s" "$N_ACTUAL_CURSOR" | grep -q '^---$' || fail "Cursor missing front-matter start"
printf "%s" "$N_ACTUAL_CURSOR" | grep -q '^alwaysApply: true$' || fail "Cursor missing alwaysApply true"
printf "%s" "$N_ACTUAL_CURSOR" | grep -q '^---$' || fail "Cursor missing front-matter end"
printf "%s" "$N_ACTUAL_CURSOR" | grep -F -q 'Source: .ruler/a.md' || fail "Cursor missing Source a.md"
printf "%s" "$N_ACTUAL_CURSOR" | grep -F -q 'Source: .ruler/subdir/b.md' || fail "Cursor missing Source subdir/b.md"
printf "%s" "$N_ACTUAL_CURSOR" | grep -q '^A content$' || fail "Cursor missing A content"
printf "%s" "$N_ACTUAL_CURSOR" | grep -q '^B content$' || fail "Cursor missing B content"

# Aider YAML should include the instructions filename in read array
grep -q '^read:' .aider.conf.yml || fail "Aider config missing read: key"
grep -q 'ruler_aider_instructions.md' .aider.conf.yml || fail "Aider config read array missing instructions filename"

# MCP for Copilot should be in .vscode/mcp.json with key 'servers'
test -f ".vscode/mcp.json" || fail "Missing .vscode/mcp.json"
grep -q '"servers"' .vscode/mcp.json || fail "MCP servers key missing for Copilot"
grep -q '"filesystem"' .vscode/mcp.json || fail "MCP server filesystem missing"
grep -q '"git"' .vscode/mcp.json || fail "MCP server git missing"

# .gitignore should include a managed block and expected paths
test -f ".gitignore" || fail "Missing .gitignore"
grep -q "# START Ruler Generated Files" .gitignore || fail "Ruler block start missing"
grep -q "# END Ruler Generated Files" .gitignore || fail "Ruler block end missing"
grep -q "\.github/copilot-instructions.md" .gitignore || fail "copilot path missing in .gitignore"
grep -q "CLAUDE.md" .gitignore || fail "CLAUDE.md missing in .gitignore"
grep -q "\.cursor/rules/ruler_cursor_instructions.mdc" .gitignore || fail "Cursor path missing in .gitignore"
grep -q "ruler_aider_instructions.md" .gitignore || fail "Aider instructions missing in .gitignore"
grep -q "\.aider\.conf\.yml" .gitignore || fail "Aider config missing in .gitignore"
grep -q "\.vscode/mcp.json" .gitignore || fail "VSCode MCP missing in .gitignore"

log "Apply verification passed. Running revert (${MODE})"

# 4) Revert
run_cli_revert

# 5) Check cleanup
test ! -e ".github" || rmdir ".github" 2>/dev/null || fail ".github not empty after revert"
test ! -e ".cursor" || rmdir ".cursor" 2>/dev/null || fail ".cursor not empty after revert"
test ! -e ".vscode" || rmdir ".vscode" 2>/dev/null || fail ".vscode not empty after revert"
test ! -e "CLAUDE.md" || fail "CLAUDE.md still exists after revert"
test ! -e "ruler_aider_instructions.md" || fail "Aider instructions still exist after revert"
test ! -e ".aider.conf.yml" || fail "Aider config still exists after revert"
test ! -e ".gitignore" || fail ".gitignore still exists after revert"

log "Revert verification passed. All good for ${MODE}."
