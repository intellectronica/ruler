# README ACCURACY REVIEW & MINIMAL UPDATE ONLY

## Objective

Review the entire codebase and the existing `README.md` to ensure the README accurately reflects the current project state. Propose and apply ONLY the minimal necessary changes to bring it up to date. If the README is already accurate, make no changes.

## Hard Constraints (Do NOT violate these)

1. IMPORTANT: You may modify ONLY `README.md`. Do not create, delete, or edit any other files. YOU ARE NOT ALLOWED TO CHANGE ANY FILE OTHER THAN `README.md`.
2. Preserve the current overall structure, section ordering, and intent of the README.
3. Make the smallest set of textual/formatting changes needed for accuracy and clarity.
4. Do NOT introduce speculative or undocumented features.
5. Do NOT add marketing fluff, badges, or sections not already present unless essential for factual correction.
6. Reformat Markdown only where it is objectively broken (e.g., incorrect headings, code fences, list indentation, inconsistent backticks) or where small adjustments improve readability without altering meaning.
7. If no changes are required, explicitly output: "No README changes needed." and stop.

## Scope of Verification (Systematically check these against the repository)

For each item below, compare what is stated in `README.md` vs. what actually exists in the repo:
- Project purpose / high-level description
- Installation instructions (package name, build/compile steps, Node/TypeScript details)
- Runtime requirements (Node version, dependencies)
- CLI usage examples (flags, commands, entry points)
- Configuration mechanisms (files, env vars, TOML/JSON/MCP references, options shown in code/tests)
- Supported agents / integrations (list matches actual implemented agents under `src/agents/`)
- File/directory structure examples (ensure paths reflect reality)
- MCP (Model Context Protocol) related behavior & limitations
- Backup / safety / overwrite behavior (as implied by tests like *backup-option*, *duplication-fix*, etc.)
- Workflow / automation references (validate against existing scripts or absence thereof)
- Any referenced scripts, binaries, or examples (ensure they exist and match names)
- License reference (ensure it matches `LICENSE`)
- Contribution / development notes (if present)
- Status / stability indicators (only keep if still true)

## Evidence Sources
Use (non-destructively) the following directories & files to ground truth:
- `src/` (implementations, constants, types, agents)
- `tests/` (behavioral expectations, supported options, edge cases)
- `package.json` (name, version, scripts, engines, dependencies, bin entries)
- `tsconfig.json` (language level if relevant)

## Change Decision Rules

Propose a change ONLY if one of these is true:
- README claims something absent from the codebase.
- README omits a clearly essential, currently implemented behavior that users must know to use existing features.
- A command / option / filename / path is outdated or renamed.
- Formatting obscures readability (mis-nested lists, broken code fences, ambiguous inline code vs prose).

## Explicitly DO NOT
- Add new feature ideas.
- Rewrite stylistically for preference alone.
- Expand sections with tangential info.
- Introduce unverified performance claims.
- Adjust license terms.

## If no changes: don't make any modifications to the file.

Process You Must Follow (Sequential)
1. Scan repository to build an internal fact map.
2. Parse current `README.md` into sections (record order; reuse it).
3. For each section, mark: accurate / outdated / missing detail / formatting issue.
4. Prepare minimal edits; reject any that are not strictly necessary.
5. Ensure internal links, code fences, and inline code consistency.
6. Ensure that you have not made any changes to any file other than `README.md`. If you have, revert those changes.
7. Stop.
8. Create pull request with a detailed list of everything changed and why.

Quality Checklist Before Emitting
- No other files touched.
- Section order preserved.
- No invented features or options.
- All modified claims verifiable in code or tests.
- Spelling & Markdown syntax valid.

## Failure Handling
If you cannot confidently verify a claim, leave it unchanged unless clearly false. Do not guess.
