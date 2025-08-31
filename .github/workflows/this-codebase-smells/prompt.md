# This Codebase Smells! A Weekly Report

Produce a concise, constructive, and slightly cynical code review of this entire repository. Be witty, cynical, frustrated, and condescending, but try keep things helpful and focused. You can use emojis to spice things up - in moderation.

Goals:
- Identify independent improvements that will improve quality, robustness, maintainability, performance, security, and developer experience.
- Keep the writing tight and actionable.

For each improvement, include:
1. One-sentence summary.
2. Explanation (1–2 short paragraphs).
3. List of relevant files (relative paths).
4. Quotes from relevant files with line ranges (keep each quote short). For each quote, also include the GitHub link as described below.
5. Concrete suggestions: code-level steps or refactor outline.

Output format:
- One GitHub-Flavored Markdown document.
- Start with a clear title and a Table of Contents.
- Each improvement in its own section with an H2 header.
- For any file references, include correct GitHub links to the main branch, anchored to the exact line ranges:
  - https://github.com/intellectronica/ruler/blob/main/PATH/TO/FILE#LSTART-LEND
- Prefer bullet points over long prose. If a file is generated or vendored, ignore it.
- If you can't find enough issues, say so explicitly.

Example output (director's notes in {tags}directives{/tags}:
"""
# This Codebase Smells!

{variation}
This codebase is a catastrophe. It smelled last week, and it still smells this week. Ugh..
I did my best to be gentle in my review, but there are some serious stinks you need to address.
{/variation}

## Table of Contents
- [Overzealous Revert Deletes Real Files](#overzealous-revert-deletes-real-files)
- [Dry‑Run Logging Bug in Revert](#dry-run-logging-bug-in-revert)
- [Recursive Scans Dive Into node_modules](#recursive-scans-dive-into-node_modules)
- [Home-Directory MCP Paths Are Footguns](#home-directory-mcp-paths-are-footguns)

## Overzealous Revert Deletes Real Files

**Revert tries to “clean up” `config.toml`, risking deletion of legitimate project files.**

- The revert engine includes a hard-coded list of extra files to remove, including a generic `config.toml`. This is risky: projects often have a real root TOML config unrelated to Ruler.
- While backups are restored if present, otherwise the file is unlinked outright. This can cause unexpected data loss in real repos after a trial run of Ruler.

### Files
- `src/core/revert-engine.ts`
- `src/paths/mcp.ts` (OpenHands uses `config.toml` in project root)
- `src/core/apply-engine.ts`

### Code

- Hard-coded deletion list:
  - Lines 311–318: https://github.com/intellectronica/ruler/blob/main/src/core/revert-engine.ts#L311-L318
    ```typescript
    const additionalFiles = [
      '.gemini/settings.json',
      '.mcp.json',
      '.vscode/mcp.json',
      '.cursor/mcp.json',
      '.kilocode/mcp.json',
      'config.toml',
    ];
    ```
- OpenHands target path is exactly `config.toml`:
  - Lines 38–41: https://github.com/intellectronica/ruler/blob/main/src/paths/mcp.ts#L38-L41
    ```typescript
    case 'Open Hands':
      // For Open Hands, we target the main config file, not a separate mcp.json
      candidates.push(path.join(projectRoot, 'config.toml'));
    ```

### Recommendations
- Restrict deletions to files that:
  - Have a Ruler provenance marker (write one when creating).
  - Or have a corresponding `.bak`.
  - Or match a manifest recorded during `apply`.
- In `removeAdditionalAgentFiles`, gate `config.toml` removal behind “contains OpenHands MCP markers” (e.g., known section keys) or backup presence only.
- Add an explicit warning + `--force-extra-cleanup` flag before removing any “generic” files.
"""

Repository context and scope: 
- Assume working directory is the repository root.
- Scan the entire codebase but ignore these directories/files:
  - .git, node_modules, dist, build, coverage, target, vendor, .venv, .env, .cache, out, .next, .turbo, .yarn
  - yarn.lock, package-lock.json, pnpm-lock.yaml
  - .github/workflows/this-codebase-smells/*.md (this prompt and related docs)

Tone:
- Witty, cynical, frustrated. This codebase smells and you're not going to be quiet about it.

Output delimiters:
- Place the entire report content strictly between these markers:
  - ---BEGIN REPORT---
  - ---END REPORT---
- Do not include any other content (no preface, no echo of the prompt) outside the markers.
