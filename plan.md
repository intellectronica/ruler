# Ruler Rust Port: Detailed Plan

Date: 2025-08-08

## Goal
Create a faithful Rust port of the Ruler CLI that behaves identically to the TypeScript implementation, validated by an end-to-end functional shell test. Work happens on a dedicated branch and will be pushed without opening a PR.

## Scope
- Implement the Ruler CLI in Rust with the same commands, flags, config discovery, and outputs:
  - Commands: `apply`, `init`, `revert`.
  - Options parity (names, defaults, negations, behavior):
    - `--project-root <path>` (default: cwd)
    - `--agents <list>` (comma-separated identifiers or substrings)
    - `--config <file>`
    - `--mcp`/`--with-mcp` (default: true)
    - `--no-mcp`
    - `--mcp-overwrite` (strategy: overwrite vs merge)
    - `--gitignore` / `--no-gitignore` (default: enabled)
    - `--verbose` / `-v`
    - `--dry-run`
    - `--local-only`
    - `revert` additional: `--keep-backups`
    - `init` additional: `--global`
  - Exit codes and error prefix: `[RulerError]` for errors.
  - Output files and directory structure are identical.

## Behavioral Parity Summary (from TS code)
- Config discovery:
  - Find `.ruler` by traversing up from `--project-root` (unless `--local-only`), else use global `$XDG_CONFIG_HOME/ruler` (fallback `~/.config/ruler`).
  - Load TOML: `.ruler/ruler.toml` or custom `--config` path; validate schema; parse `default_agents`, `[agents.*]`, `[mcp]`, `[gitignore]`.
  - CLI precedence: CLI flags > TOML > defaults.
- Rules concatenation:
  - Recursively read all `.md` files under the chosen `.ruler` directory (alphabetical by path).
  - Concatenate sections with header: `---\nSource: <relative-path>\n---\n<content>\n`.
- Agents and outputs:
  - Supported agents set mirrors TS (copilot, claude, codex, cursor, windsurf, cline, aider, firebase, openhands, gemini-cli, jules, junie, augmentcode, kilocode, opencode, goose, crush, amp) with their default output paths.
  - Build per-agent selection:
    - If `--agents`, filter by exact identifier OR substring of display name; validate unknown filters error with valid list.
    - Else if `default_agents` in TOML, include those (consider per-agent `enabled` overrides).
    - Else include all agents except those explicitly disabled in TOML.
  - For multi-output agents (Aider: instructions + config; others as defined), compute .gitignore paths including backups.
  - Special front-matter for Cursor output: YAML front-matter with `alwaysApply: true`.
  - For Aider, update `.aider.conf.yml` (YAML) to include the instructions file name in `read` array.
- MCP propagation:
  - Read `.ruler/mcp.json` if present; validate it includes `mcpServers` object.
  - Determine native MCP path per agent and within project/global locations (see TS `paths/mcp.ts`).
  - Strategy: `merge` (default) or `overwrite` from CLI/TOML/agent overrides; `--no-mcp` disables.
  - Server key per agent: default `mcpServers`, Copilot uses `servers`; AugmentCode handled via VS Code settings; OpenHands and OpenCode use dedicated propagators.
  - Merge semantics (TS `mcp/merge.ts`): union of servers for `merge`, or replace servers while normalizing key names for `overwrite`.
- .gitignore updates:
  - Maintain a managed block between `# START Ruler Generated Files` and `# END Ruler Generated Files`.
  - Convert paths to relative POSIX (strip project root prefix if present), sort, deduplicate; include generated outputs and their `.bak` backups and `*.bak` wildcard.
  - Preserve existing content outside first Ruler block; replace first Ruler block if present; append block if none.
- Revert behavior:
  - For each selected agent’s outputs and (project-local) MCP files:
    - If `<file>.bak` exists, restore file from backup and optionally remove backup (unless `--keep-backups`).
    - Else, if file exists and has no backup, delete it.
  - Clean VS Code settings for AugmentCode (remove `augment.advanced` section, possibly delete empty file).
  - Remove additional files list (.gemini/settings.json, .mcp.json, .vscode/mcp.json, .cursor/mcp.json, .kilocode/mcp.json, .openhands/config.toml) using same logic.
  - Remove empty directories created by Ruler (.github, .cursor, .windsurf, .junie, .openhands, .idx, .gemini, .vscode, .augmentcode, .kilocode) when they become empty; special handling for `.augment/rules`.
  - Optionally clean the Ruler block from .gitignore if not filtering by agents.

## Functional Test Strategy (shell)
- Create `scripts/functional_test.sh`:
  - Prereqs: Node 18+ available; uses published TS CLI via local build or `node dist/cli/index.js` from workspace.
  - Steps per run (isolated temp dir with `mktemp -d`):
    1) Initialize a mock project structure; create `.ruler` with several `.md` files, `ruler.toml`, and `mcp.json`.
    2) Run TypeScript Ruler: `node dist/cli/index.js apply ...` (or `npm pack`+`npx` if necessary). Capture stdout/stderr and exit code.
    3) Verify expected files exist with exact contents:
       - `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/ruler_cursor_instructions.mdc` with front-matter, Aider files, etc.
       - MCP files merged/overwritten depending on flags.
       - `.gitignore` contains a managed block with expected entries.
    4) Run `revert` and confirm restoration/cleanup behavior including backups and directory removals.
    5) Repeat the same flow substituting the Rust binary once implemented.
  - The script should print diff summaries when mismatches occur and exit non-zero.

Notes:
- We’ll design the script so it can be run before the Rust implementation exists; in that case it only validates TS and skips Rust, returning success. After Rust exists, it will validate parity by comparing file trees and specific content.
- For deterministic diffs, set stable mtime or avoid time-sensitive content.

## Rust Implementation Plan

### Structure
- Create `rust/` workspace directory containing a single binary crate `ruler-rs`.
- Use crates:
  - CLI: `clap` (derive) for yargs-like flags and `--no-*` handling via bool flags and option overrides.
  - TOML parsing: `toml` + `serde` with custom structs mirroring TS schema; validate with a small custom validator akin to zod rules.
  - YAML: `serde_yaml` for Aider config.
  - JSON: `serde_json`.
  - Filesystem: std fs + `walkdir` for recursive markdown discovery.
  - Paths: `pathdiff` for relative POSIX conversion, or manual logic.
  - Logging/verbosity: simple `eprintln!` gated on `--verbose`.

### Modules
- `cli.rs`: parse subcommands and flags; map to handlers; error handling with `[RulerError]` prefix and exit 1.
- `config.rs`: load `.ruler` dir, read `ruler.toml`, build `LoadedConfig` (default_agents, agentConfigs, mcp, gitignore, cliAgents), apply precedence, resolve per-agent overrides.
- `fs_utils.rs`: find `.ruler` (upwards), read markdown files sorted, write files with parent dir creation, backup/restore helpers, ensure dir exists; .gitignore updater (block replace/append) matching TS behavior; directory emptiness and removal logic.
- `mcp.rs`: validate `.ruler/mcp.json`, merge/overwrite logic with server key mapping; read/write native MCP JSON; agent-specific destinations (matching `paths/mcp.ts` and special cases for OpenHands/OpenCode/AugmentCode).
- `agents/`: one adapter per agent implementing trait:
  ```
  trait Agent {
      fn identifier(&self) -> &'static str;
      fn name(&self) -> &'static str;
      fn default_output(&self, project_root: &Path) -> OutputSpec; // single or multi-path
      fn mcp_server_key(&self) -> Option<&'static str> { None }
      fn apply(&self, rules: &str, project_root: &Path, mcp: Option<&Value>, cfg: &AgentCfg, dry_run: bool) -> Result<()>
  }
  ```
  - Implementations mirror TS adapters (including Cursor front-matter; Aider YAML `read` update).
  - OutputSpec enum to represent single path or map with keys `instructions` and `config`.
- `apply.rs`: selection of agents (CLI filters, defaults, enabled overrides), concatenation, writing outputs, MCP propagation, and .gitignore update logic identical to TS order and messages.
- `revert.rs`: mirror TS revert flow including counts and summaries; VS Code settings cleanup for AugmentCode.
- `init.rs`: create `.ruler` directory and three default files with same default contents as TS.

### UX Parity
- Console messages:
  - Use `[ruler]` and `[ruler:dry-run]` prefixes as in TS; `Ruler apply completed successfully.` at end of apply; revert summary lines identical.
  - Errors prefixed with `[RulerError]` and include context messages similar to TS.

### Build & Distribution
- Add `Cargo.toml` with binary `ruler-rs`.
- Provide `Makefile`/npm script wrappers optional; not required.

## Implementation Steps
1) Add `plan.md` (this file).
2) Add `scripts/functional_test.sh` that runs the TS CLI; confirm it passes in CI-like local environment.
3) Scaffold `rust/ruler-rs` crate with `cargo init --bin` and basic clap CLI with subcommands and flags (no logic yet).
4) Implement shared helpers: .ruler discovery, TOML loader, markdown concatenation, .gitignore block updater.
5) Implement agents with only Copilot/Claude/Cursor/Aider first; wire `apply` minimal to write files; validate with functional test for a limited agent set.
6) Implement MCP handling paths and merge/overwrite strategies; extend agents to full set (as necessary for functional test coverage; aim for parity for all in TS list).
7) Implement `revert` logic and VS Code settings handling for AugmentCode.
8) Iterate running `scripts/functional_test.sh` comparing TS vs Rust outputs in clean tmp projects until parity.
9) Commit work in branch and push to origin (no PR).

## Risks & Mitigations
- Path normalization differences (Windows vs POSIX): focus on POSIX/macos as primary; ensure relative POSIX formatting for .gitignore.
- YAML serialization differences: configure `serde_yaml` emitter to match JS `js-yaml` defaults (ordering not critical but ensure `read` includes filename).
- JSON key ordering: not significant for functionality; but tests should compare parsed JSON or normalize before diff.
- CLI flag parity: validate with multiple flag combos; add explicit unit-like checks in the shell script.

## Acceptance Criteria
- Functional script passes fully for TS implementation.
- After Rust implementation, the same script passes for Rust and any content diffs detected are resolved.
- All commands (`init`, `apply`, `revert`) behave as documented and match console output expectations.
