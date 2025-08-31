# This Codebase Smells! A Weekly Report

Produce a concise, constructive, and slightly cynical code review of this entire repository. Be witty, but keep it helpful and focused. No emojis.

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

Repository context and scope:
- Assume working directory is the repository root.
- Scan the entire codebase but ignore these directories/files:
  - .git, node_modules, dist, build, coverage, target, vendor, .venv, .env, .cache, out, .next, .turbo, .yarn
  - yarn.lock, package-lock.json, pnpm-lock.yaml
  - .github/workflows/this-code-smells/*.md (this prompt and related docs)

Tone:
- Witty, slightly frustrated, but constructive and respectful. Aim for helpful, not snarky.
