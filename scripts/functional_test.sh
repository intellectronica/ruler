#!/usr/bin/env bash
set -euo pipefail

# Functional test for Ruler TS vs Rust (when available)
# - Pre-req: TypeScript dist build exists (npm run build)
# - On macOS zsh/bash

here="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$here/.." && pwd)"

run_ts() {
  node "$repo_root/dist/cli/index.js" "$@"
}

run_rust() {
  if command -v "$repo_root/rust/target/debug/ruler-rs" >/dev/null 2>&1; then
    "$repo_root/rust/target/debug/ruler-rs" "$@"
  else
    return 127
  fi
}

mkproj() {
  local dir
  dir="$(mktemp -d)"
  mkdir -p "$dir/.ruler/sub"
  cat >"$dir/.ruler/instructions.md" <<'EOF'
# Top Rules
Use consistent style.
EOF
  cat >"$dir/.ruler/sub/additional.md" <<'EOF'
# Extra
More rules here.
EOF
  cat >"$dir/.ruler/ruler.toml" <<'EOF'
# default_agents = ["copilot", "claude", "cursor", "aider"]
[agents.claude]
enabled = true
[agents.copilot]
enabled = true
[agents.cursor]
enabled = true
[agents.aider]
enabled = true

[mcp]
enabled = true
merge_strategy = "merge"

[gitignore]
enabled = true
EOF
  cat >"$dir/.ruler/mcp.json" <<'EOF'
{
  "mcpServers": {
    "filesystem": { "command": "node", "args": ["fs.js"] },
    "git": { "command": "node", "args": ["git.js"] }
  }
}
EOF
  echo "$dir"
}

check_exists() {
  local path="$1"
  [[ -f "$path" ]] || { echo "Missing file: $path"; return 1; }
}

normalize_gitignore() {
  # Strip non-Ruler lines; keep Ruler block for comparison
  sed -n '/# START Ruler Generated Files/,/# END Ruler Generated Files/p' "$1" | sed 's|^\./||'
}

compare_contents() {
  local a="$1" b="$2"
  local ta tb
  ta="$(mktemp)"; tb="$(mktemp)"
  # Normalize: trim trailing spaces on lines and remove trailing blank lines
  python3 - "$a" >"$ta" <<'PY'
import sys
p=sys.argv[1]
with open(p,'r',encoding='utf-8') as f:
    s=f.read()
lines=s.splitlines()
lines=[ln.rstrip() for ln in lines]
while lines and lines[-1]=="":
    lines.pop()
print("\n".join(lines))
PY
  python3 - "$b" >"$tb" <<'PY'
import sys
p=sys.argv[1]
with open(p,'r',encoding='utf-8') as f:
    s=f.read()
lines=s.splitlines()
lines=[ln.rstrip() for ln in lines]
while lines and lines[-1]=="":
    lines.pop()
print("\n".join(lines))
PY
  if ! diff -u "$ta" "$tb" >/dev/null; then
    echo "Diff for $a vs $b:" >&2
    diff -u "$ta" "$tb" || true
    rm -f "$ta" "$tb"
    return 1
  fi
  rm -f "$ta" "$tb"
}

concat_preview() {
  # Produces the concatenated rules with source headers as TS does
  # Important: TS uses path.relative(process.cwd(), filePath). Our process.cwd() is repo_root.
  local root="$1"
  local cwd="$2" # repo_root
  (
    cd "$root/.ruler" && {
      # Find all .md files alphabetically (recursively)
      LC_ALL=C find . -type f -name '*.md' | sort | while read -r f; do
        # Compute absolute file path, then relative to cwd (repo_root)
        local abs="$root/.ruler/${f#./}"
        local rel
        # Use python or node for robust path.relativize if available; fallback to manual realpath+sed
        if command -v node >/dev/null 2>&1; then
          CWD="$cwd" ABS="$abs" rel="$(CWD="$cwd" ABS="$abs" node -e 'const p=require("path");const {CWD,ABS}=process.env;console.log(p.relative(CWD, ABS));')"
        else
          # POSIX approximation: attempt to print abs; not ideal but CI uses node
          rel="$abs"
        fi
        echo "---"
        echo "Source: $rel"
        echo "---"
        sed -e 's/[\t ]*$//' "$f"
        echo
      done
    }
  )
}

run_case() {
  local tool_name="$1"; shift
  local runner="$1"; shift
  local tmp
  tmp="$(mkproj)"; trap 'rm -rf "${tmp:-}"' RETURN

  echo "[$tool_name] init/apply"
  "$runner" init --project-root "$tmp" >/dev/null
  "$runner" apply --project-root "$tmp" --agents copilot,claude,cursor,aider --verbose >/dev/null

  # Check expected files
  check_exists "$tmp/CLAUDE.md"
  check_exists "$tmp/.github/copilot-instructions.md"
  check_exists "$tmp/.cursor/rules/ruler_cursor_instructions.mdc"
  check_exists "$tmp/ruler_aider_instructions.md"
  check_exists "$tmp/.aider.conf.yml"
  check_exists "$tmp/.gitignore"

  # Validate concatenation logic
  concat_preview "$tmp" "$repo_root" >"$tmp/_expected_rules.txt"
  # Cursor has a front-matter we need to add
  {
    echo "---"; echo "alwaysApply: true"; echo "---"
    cat "$tmp/_expected_rules.txt"
  } >"$tmp/_expected_cursor.txt"

  compare_contents "$tmp/_expected_rules.txt" "$tmp/CLAUDE.md"
  compare_contents "$tmp/_expected_rules.txt" "$tmp/.github/copilot-instructions.md"
  compare_contents "$tmp/_expected_cursor.txt" "$tmp/.cursor/rules/ruler_cursor_instructions.mdc"

  # Validate aider config references the md
  grep -q '^read:' "$tmp/.aider.conf.yml" || { echo "aider config missing read"; return 1; }
  grep -q 'ruler_aider_instructions.md' "$tmp/.aider.conf.yml" || { echo "aider read missing file"; return 1; }

  # Validate gitignore contains Ruler block entries for generated files
  normalize_gitignore "$tmp/.gitignore" >"$tmp/_gi.txt"
  grep -q 'CLAUDE.md' "$tmp/_gi.txt"
  grep -q '.github/copilot-instructions.md' "$tmp/_gi.txt"
  grep -q '.cursor/rules/ruler_cursor_instructions.mdc' "$tmp/_gi.txt"
  grep -q 'ruler_aider_instructions.md' "$tmp/_gi.txt"
  grep -q '.aider.conf.yml' "$tmp/_gi.txt"

  # Revert and ensure cleanup/restoration works
  echo "[$tool_name] revert"
  "$runner" revert --project-root "$tmp" --verbose >/dev/null

  # Generated files should be removed (no backups by default for first write)
  [[ ! -f "$tmp/CLAUDE.md" ]]
  [[ ! -f "$tmp/.github/copilot-instructions.md" ]]
  [[ ! -f "$tmp/.cursor/rules/ruler_cursor_instructions.mdc" ]]
  [[ ! -f "$tmp/ruler_aider_instructions.md" ]]
  [[ ! -f "$tmp/.aider.conf.yml" ]]

  # Gitignore ruler block removed
  if [[ -f "$tmp/.gitignore" ]]; then
    ! grep -q '# START Ruler Generated Files' "$tmp/.gitignore"
  fi

  echo "[$tool_name] OK"
  # clear trap for RETURN so later RETURNs don't reference out-of-scope vars
  trap - RETURN
}

main() {
  # Ensure TS build present
  if [[ ! -f "$repo_root/dist/cli/index.js" ]]; then
    echo "Building TypeScript..." >&2
    (cd "$repo_root" && npm run -s build) >/dev/null
  fi

  run_case "TypeScript" run_ts

  if run_rust --help >/dev/null 2>&1; then
    run_case "Rust" run_rust
  else
    echo "Rust binary not found; skipping Rust validation." >&2
  fi
}

main "$@"
