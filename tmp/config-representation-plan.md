# Ruler Unified Configuration Representation Design

Date: 2025-08-24
Status: Proposal / Pre-implementation
Owner: (fill in)

## 1. Objective

Create a single, rich in-memory object graph representing the complete Ruler configuration state for a project, including:

1. Parsed `ruler.toml` (global + per-agent sections, gitignore, mcp) with schema validation.
2. All rule/instruction markdown (each source file + canonical concatenated form + checksum & metadata).
3. MCP server configuration (canonical internal structure) loaded from `.ruler/mcp.json` (and potentially future sources) with normalization to a unified shape.
4. Derived / resolved agent output paths and effective per-agent settings after precedence resolution (CLI > per-agent overrides > defaults > implicit).
5. Provenance metadata (file paths, mtimes, content hashes) enabling efficient change detection & caching.
6. Error collection with structured diagnostics (file, section, severity, message) allowing partial operation if non-fatal.

The representation will become the authoritative input for apply / revert engines and any future features (e.g., editor integration, watch mode, config introspection commands, LSP style services).

## 2. Current State Summary

Currently, configuration concerns are distributed:

- `ConfigLoader.loadConfig` parses TOML and returns a `LoadedConfig` lacking rule content and without unified MCP detail (only global & agent-level enable/strategy flags).
- `apply-engine.loadRulerConfiguration` separately reads markdown files, concatenates them, and optionally loads raw `mcp.json` (light validation only) leaving downstream code to interpret.
- MCP propagation modules (`propagateOpenHands`, `propagateOpenCode`, `mergeMcp`) each transform independently from the raw JSON shape.
- There is no structured representation of individual rule file segments; only a concatenated string is passed to agents.
- No caching beyond runtime variables; repeated runs re-parse and re-read everything.
- No explicit change detection infrastructure (for potential watch mode or incremental updates).

Pain Points / Risks:
1. Duplication of logic around locating `.ruler` directory & reading files.
2. Harder to extend (e.g., adding new config sections, referencing rules by semantic tags).
3. No typed MCP server structure; transformations rely on loose records.
4. Hard to test granularly (tests must replicate multi-step load).

## 3. Target Unified Types

### 3.1 Root Interface
```
interface RulerUnifiedConfig {
	meta: ConfigMeta;              // Discovery + version + root paths
	toml: TomlConfig;              // Parsed + validated TOML (normalized)
	rules: RulesBundle;            // All rule files & concatenations
	mcp: McpBundle | null;         // Unified MCP servers & metadata
	agents: Record<string, EffectiveAgentConfig>; // Effective agent state
	diagnostics: ConfigDiagnostic[];             // Non-fatal issues
	hash: string;                   // Overall content hash (stable ordering)
}
```

### 3.2 Metadata
```
interface ConfigMeta {
	projectRoot: string;
	rulerDir: string;              // absolute path to .ruler
	configFile?: string;           // ruler.toml path (if found)
	mcpFile?: string;              // mcp.json path (if found)
	loadedAt: Date;
	version: string;               // Ruler package version (from package.json)
}
```

### 3.3 TOML Representation
```
interface TomlConfig {
	raw: unknown; // original parsed object
	schemaVersion: number; // future use (default 1)
	defaultAgents?: string[];
	agents: Record<string, AgentTomlConfig>; // original agent sections normalized
	mcp?: McpToggleConfig; // enable/strategy only
	gitignore?: GitignoreConfig; // existing type
}

interface AgentTomlConfig {
	enabled?: boolean;
	outputPath?: string;             // resolved absolute
	outputPathInstructions?: string; // resolved absolute
	outputPathConfig?: string;       // resolved absolute
	mcp?: McpConfig;                 // enabled/strategy
	source: AgentConfigSourceMeta;   // provenance
}

interface AgentConfigSourceMeta {
	sectionPath: string; // e.g. agents.copilot
}
```

### 3.4 Rules Representation
```
interface RulesBundle {
	files: RuleFile[];           // sorted deterministic order
	concatenated: string;        // existing style with header markers
	concatenatedHash: string;    // sha256
}

interface RuleFile {
	path: string;                // absolute
	relativePath: string;        // relative to rulerDir parent
	content: string;
	contentHash: string;         // sha256
	mtimeMs: number;
	size: number;
	order: number;               // final ordering index
	primary: boolean;            // AGENTS.md vs others
}
```

### 3.5 MCP Representation
```
interface McpBundle {
	servers: Record<string, McpServerDef>; // normalized standard shape
	raw: Record<string, unknown>;          // original parsed mcp.json
	hash: string;                          // sha256 stable JSON
}

interface McpServerDef {
	type?: 'stdio' | 'local' | 'remote';   // derived
	command?: string;                      // single command root
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
	// Additional future metadata (timeouts, labels, categories)
}
```

### 3.6 Effective Agent Config
```
interface EffectiveAgentConfig {
	identifier: string;              // internal agent identifier
	enabled: boolean;                // after precedence resolution
	output: AgentOutputPaths;        // resolved output paths (instructions/config etc.)
	mcp: EffectiveMcpConfig;         // resolved enable/strategy
	toml?: AgentTomlConfig;          // raw reference (undefined if missing)
}

interface AgentOutputPaths {
	instructions?: string;
	config?: string;
	generic?: string; // single output_path case
}

interface EffectiveMcpConfig {
	enabled: boolean; // default true unless disabled
	strategy: McpStrategy; // resolved precedence (CLI > per-agent > global > default 'merge')
}
```

### 3.7 Diagnostics
```
type DiagnosticSeverity = 'info' | 'warning' | 'error';
interface ConfigDiagnostic {
	severity: DiagnosticSeverity;
	code: string;           // e.g. TOML_PARSE_ERROR, MCP_INVALID_FORMAT
	message: string;
	file?: string;
	detail?: string;
}
```

## 4. Loading Pipeline

Step sequence (all inside new `UnifiedConfigLoader.load(options)`):
1. Discover project root & `.ruler` directory (reuse / refactor `FileSystemUtils.findRulerDir`).
2. Locate `ruler.toml` (local first, fallback global) & parse -> intermediate raw object.
3. Validate with existing Zod schema (extend slightly if needed) -> build `TomlConfig` with path resolution.
4. Enumerate markdown rule files: deterministic ordering:
	 a. If `AGENTS.md` present, it is first.
	 b. Then all other `**/*.md` under `.ruler` (excluding hidden?) sorted lexicographically by relative path.
5. Read each file (parallel with limit), capture stats (mtime, size), compute sha256.
6. Build `RulesBundle` & derive concatenated string using existing formatting function (refactor to accept already-read list).
7. Load `mcp.json` (if present): parse JSON, structural validation (existing + enhanced: ensure object & values shape heuristics), normalize server entries to `McpServerDef`. Record diagnostics instead of throwing for non-critical validation (invalid entries skipped).
8. Build `McpBundle` with hash.
9. Resolve effective agent config:
	 - Start list of all compiled-in agents (introspect from agents registry / passed array; for loader may accept agent identifiers list to pre-resolve).
	 - Determine default enablement: if `default_agents` present -> disabled unless appears in that list (subject to per-agent enable override); else enabled unless explicitly disabled.
	 - Incorporate CLI filters (passed separately at selection time; may not need embedding in unified object except for reproducibility -> optional property `cliAgentFilter?: string[]`).
	 - Resolve output paths using existing logic (centralize inside a util pure function using `AgentTomlConfig`).
	 - Resolve MCP effective (merging CLI strategy & enable flag precedence).
10. Compute overall config hash = sha256 of stable JSON serialization of: toml.normalized subset + rules.concatenatedHash + (mcp.hash || 'null') + sorted agent effective fragments.
11. Return assembled `RulerUnifiedConfig`.

Concurrency considerations: use controlled parallelism (e.g., `Promise.all` on file reads) — small scale so not critical to throttle at present.

## 5. Caching & Invalidation Strategy

Introduce simple in-memory cache keyed by projectRoot + optional configPath + CLI filters hash. Each cache entry stores:
```
interface CachedEntry { config: RulerUnifiedConfig; fileHashes: Record<string,string>; }
```
Invalidation check on subsequent load:
1. For each tracked file (toml, mcp.json, each rule file) stat -> mtime & size; if changed OR if new file discovered OR removed -> full reload.
2. Optional optimization: if only rule files changed, can skip TOML & MCP parse reuse.
3. Provide `forceReload` option bypassing cache.

Future extension: persistent cache on disk (not in initial scope).

## 6. Error Handling Philosophy

Fatal (throw):
- Missing `.ruler` directory when required.
- Unreadable `ruler.toml` with non-ENOENT error (I/O) or invalid schema (retain current behavior? Optionally degrade to diagnostic w/ empty config if we want resilience — choose STRICT for now to avoid silent misconfig).

Non-fatal (diagnostic):
- Missing `mcp.json`.
- Invalid individual MCP server entries (skip only those entries).
- Empty rules directory (warning, still proceed with empty concatenation).

## 7. Incremental Refactor / Migration Plan

Phased approach to reduce risk:
1. Add new type definitions + `UnifiedConfigLoader` alongside existing loader (no changes to external APIs yet).
2. Implement tests targeting new loader (unit: TOML parsing, rules ordering, MCP normalization; integration: full directory scenario).
3. Adapt `apply-engine.loadRulerConfiguration` to call new loader and map old `RulerConfiguration` shape from unified object (backwards compatibility layer) — ensure all current tests remain green.
4. Deprecate direct use of `loadConfig`, `concatenateRules`, and raw MCP JSON retrieval inside apply engine; mark with comments.
5. Update code using `LoadedConfig` to consider migrating directly to unified object (optional second pass).
6. Document new internal API; optionally expose via `lib` if needed later.
7. Remove legacy paths after two releases (future task).

## 8. Test-Driven Development Plan

### 8.1 Unit Tests
- `UnifiedConfigLoader`:
	- Parses minimal TOML (empty file) -> defaults.
	- Honors `default_agents` precedence.
	- Resolves relative output paths to absolute.
	- Aggregates rule files ordering (AGENTS.md first, then others).
	- Computes stable concatenated hash (changing one file changes bundle hash only).
	- MCP parsing: valid stdio server, invalid server skipped with diagnostic.
	- MCP normalization: remote server (url) vs local (command/args) retains correct fields.
	- Effective enablement logic permutations (default_agents present vs absent; explicit disable).

### 8.2 Integration Tests
- Full fixture directory with:
	- Multiple rule files nested subdirectories.
	- MCP JSON with mix of servers.
	- Agent overrides for output paths.
	- CLI agent filter scenario (simulate invocation).
	- Snapshot test for unified object (selective JSON pick, excluding timestamps & path specifics via normalization helper).

### 8.3 Edge Cases
- Missing `.ruler` directory -> error.
- Missing `ruler.toml` -> treat as empty (consistent with current). Confirm by test.
- Empty rules directory -> warning diagnostic.
- Large rule file (performance smoke — ensure no truncation; maybe just length assertion).

### 8.4 Regression Tests (Existing Behavior Guard)
- Reuse existing `apply-engine` integration tests; after wiring new loader, confirm no diff in generated outputs (could add a test asserting equivalence of legacy vs unified mapping for a fixture).

### 8.5 Hash Stability
- Test stable hash unaffected by file read order (shuffle simulation by injecting ordering override in test harness to ensure deterministic sorting logic works).

## 9. Implementation Outline

New files:
- `src/core/UnifiedConfigTypes.ts` (interfaces & types above).
- `src/core/UnifiedConfigLoader.ts` (implementation & optional caching static module variable).
- `src/core/hash.ts` (small util for sha256 on string & stable JSON).
- `tests/unit/core/unified-config-loader.test.ts` (unit cases).
- `tests/integration/unified-config-loader.test.ts` (end-to-end fixture).

Refactors:
- Modify `apply-engine.loadRulerConfiguration` to invoke new loader, then return old `RulerConfiguration` composed from unified object interim (preserve current interface for now).

Utilities:
- Extend existing `FileSystemUtils.readMarkdownFiles` to optionally return stats or create new `readMarkdownFilesWithMeta` to avoid double stat.
- Add `normalizeMcpServers(raw: Record<string, unknown>): Record<string, McpServerDef>`.
- Add `computeOverallConfigHash(unified: RulerUnifiedConfig): string`.

## 10. Precedence Rules (Formalized)

Enabled flag resolution per agent:
1. If CLI filter list provided: only those matching filters considered enabled (others implicitly disabled for this run) — this is runtime selection, not encoded as `enabled=false` in unified object; we store filter separately.
2. Else if `default_agents` specified in TOML:
	 - Enabled if identifier or fuzzy name matches list unless explicit `enabled=false`.
3. Else (no `default_agents`): enabled unless explicit `enabled=false` in agent section.

MCP enable resolution:
1. CLI `--mcp` (bool) + `--mcp-overwrite` (strategy) override.
2. Per-agent `mcp.enabled` if defined.
3. Global `mcp.enabled` if defined.
4. Default: true.

MCP strategy resolution: CLI strategy > per-agent > global > 'merge'.

Output path resolution precedence (for instructions & config):
1. Agent-specific `output_path_instructions` & `output_path_config` if present.
2. Single `output_path` fallback to treat as instructions (maintain existing semantics).
3. If none specified, rely on each agent's internal default path logic (unified object can omit path -> downstream agent decides). We'll capture any resolved outputs post-application? (Out of scope — we keep only explicit config-driven paths.)

## 11. Performance Considerations

Scope is small (dozens of files). Hashing + parsing negligible. Simple caching prevents repeated work in multi-agent apply.
Potential future optimization: memoize concatenated rules per rules hash to avoid re-serialization.

## 12. Open Questions / Deferred Items

- Should diagnostics include suggested fixes? (Future enhancement)
- Do we want watch mode incremental diff emission? (Future)
- Expose unified config via CLI (`ruler config --json`)? (Future)
- Disk-backed cache? (Future)

## 13. Rollout & Backwards Compatibility

Initial release keeps external API unchanged. If later exposing unified config, version with `configVersion` field. Provide migration note in README when legacy loader flagged deprecated.

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Divergence between legacy & unified logic | Write equivalence tests mapping unified -> legacy shapes |
| Silent MCP normalization mistakes | Add snapshot test on a complex MCP fixture |
| Non-deterministic concatenation ordering | Force explicit sort & test stability |
| Hash collisions (improbable) | Use sha256; acceptable risk |

## 15. Implementation Task Breakdown

1. Define new type modules.
2. Implement hashing util.
3. Implement normalization helpers (paths, MCP, rules ordering).
4. Implement loader w/ diagnostics.
5. Add tests (unit first, red -> green cycle): TOML minimal, rules ordering, MCP normalization, precedence resolution, hash stability.
6. Add integration test fixture.
7. Integrate loader into apply engine behind feature flag or direct swap (ensuring tests pass).
8. Add equivalence regression test.
9. Document & finalize design doc (this file).

## 16. Success Criteria

Mandatory:
- All existing tests remain green after integration.
- New tests cover >90% branches in loader (approx) – measured via existing coverage tools.
- Unified object supplies all data previously derived ad-hoc.

Stretch:
- Provide CLI debugging command to dump unified config (optional not in MVP).

## 17. Example Unified Object (Illustrative)
```jsonc
{
	"meta": { "projectRoot": "/workspace", "rulerDir": "/workspace/.ruler", "configFile": "/workspace/.ruler/ruler.toml", "loadedAt": "2025-08-24T12:34:56.000Z", "version": "1.2.3" },
	"toml": { "defaultAgents": ["copilot"], "agents": { "copilot": { "enabled": true, "outputPath": "/workspace/.github/copilot.md" } } },
	"rules": { "files": [ { "relativePath": "AGENTS.md", "order": 0, "primary": true } ], "concatenatedHash": "..." },
	"mcp": { "servers": { "example": { "type": "stdio", "command": "node", "args": ["server.js"] } }, "hash": "..." },
	"agents": { "copilot": { "identifier": "copilot", "enabled": true, "output": { "generic": "/workspace/.github/copilot.md" }, "mcp": { "enabled": true, "strategy": "merge" } } },
	"diagnostics": [],
	"hash": "overall-hash"
}
```

---
End of design.

## Progress Log

2025-08-24:
- Created feature branch `feature/unified-config`.
- Added TDD scaffolding: failing unit & integration placeholder tests.
- Added integration fixture with sample `.ruler` directory.
- Implemented type definitions (`UnifiedConfigTypes.ts`).
- Implemented hashing utilities (`hash.ts`).
- Added initial loader skeleton (`UnifiedConfigLoader.ts`) returning placeholders (tests intentionally failing).
- Next: implement loader functionality incrementally to satisfy unit tests (empty TOML -> defaults, rule ordering) then expand to MCP & effective agent resolution.


