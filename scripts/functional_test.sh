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

