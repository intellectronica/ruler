# @udecode/ruler

## 0.4.0

### Minor Changes

- ee83dd2: ## 1. CLAUDE.md @filename References
  - Uses `@filename` syntax instead of merging content
  - Claude Code auto-includes referenced files
  - Reduces CLAUDE.md size and keeps sources separate
  - Other agents still get merged content

  ## 2. MDC File Support
  - Supports both `.md` and `.mdc` files (Nuxt Content, Vue)
  - All patterns auto-expand: `"components"` → `"components/**/*.{md,mdc}"`

  ## 3. Rules Filtering
  - `include`/`exclude` glob patterns in `[rules]`
  - Directory names auto-expand to `directory/**/*.{md,mdc}`
  - Organize by team/feature, exclude drafts/internal docs

  ## 4. Claude Root Folder
  - `ruler init --claude` creates `.claude/` instead of `.ruler/`
  - Skills already in `.claude/skills` (no copying)
  - Single directory for all Claude Code config

  ## 5. Cursor-style Rules
  - `merge_strategy = "cursor"` parses `.mdc` frontmatter
  - Only includes rules with `alwaysApply: true`
  - Strips frontmatter, keeps body only

  ## 6. Backup Control
  - `[backup].enabled = false` disables `.bak` files

  ## 7. Auto-Generate Skills from Rules
  - `[skills].generate_from_rules = true` creates skills from .mdc files
  - Only generates from files with `alwaysApply: false` (or undefined)
  - Files with `alwaysApply: true` are merged into AGENTS.md instead
  - Automatically removes skills when `alwaysApply` changes to `true`
  - Skills use @filename references to original .mdc (for Claude Code)
  - MCP agents (excluding Cursor) get full content in .skillz (frontmatter stripped)
  - Cursor uses .cursor/rules directly (no skillz MCP needed)
  - Globs appended to description: "Applies to files matching: ..."
  - **Folder support**: `rules/docx/docx.mdc` + `rules/docx/script.sh` → `skills/docx/SKILL.md` + `skills/docx/script.sh`
