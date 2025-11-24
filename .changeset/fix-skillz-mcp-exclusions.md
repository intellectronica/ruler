---
'@udecode/ruler': patch
---

Fix skillz MCP and Codex config issues

- Exclude Claude Code and Cursor from skillz MCP (they use native skills support)
- Fix Codex creating duplicate config files (.codex/config.json and .codex/config.toml)
- Add CursorAgent.supportsNativeSkills() for cleaner architecture
