---
"skiller": minor
---

Add `prune` option to `[skills]` config for handling orphaned skills

- `prune = true`: Auto-delete orphaned skills (skills in `.claude/skills/` not generated from any `.mdc` rule)
- `prune = false`: Keep orphaned skills without prompting
- `prune` undefined: Interactive prompt asking to delete, with recommendation to set config
