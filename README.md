# Ruler

A CLI tool to manage custom rules and configs across different AI coding agents.

## Features

- Centralise AI agent instructions in a single `.ruler/` directory
- Distribute rules to supported agents (GitHub Copilot, Claude Code, OpenAI Codex CLI, Cursor, Windsurf, Cline, Aider)
- Extensible architecture: add new agent adapters easily

## Installation

Install globally:

```bash
npm install -g @intellectronica/ruler
```

Or use npx:

```bash
npx @intellectronica/ruler apply
```

## Usage

Create a `.ruler/` directory at your project root and add Markdown files defining your rules:

```
.ruler/
├── coding_guidelines.md
└── style_guide.md
```

Run the apply command:

```bash
ruler apply [--project-root <path>] [--agents <agent1,agent2,...>]
```

Use `--agents` to specify a comma-separated list of agent names (case-insensitive substrings) to limit which agents the rules are applied to.

The command will read all `.md` files under `.ruler/`, concatenate their contents, and generate/update configuration files for the following agents:

| Agent                  | File(s) Created/Updated                                    |
| ---------------------- | ----------------------------------------------------------- |
| GitHub Copilot         | `.github/copilot-instructions.md`                           |
| Claude Code            | `CLAUDE.md`                                                 |
| OpenAI Codex CLI       | `AGENTS.md`                                                 |
| Cursor                 | `.cursor/rules/ruler_cursor_instructions.md`                |
| Windsurf               | `.windsurf/rules/ruler_windsurf_instructions.md`            |
| Cline                  | `.clinerules`                                               |
| Aider                  | `ruler_aider_instructions.md` <br>and updates `.aider.conf.yml` |

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/intellectronica/ruler.git
cd ruler
npm install
npm run build
```

Run linting and formatting checks:

```bash
npm run lint
npm run format
```

Run tests:

```bash
npm test
```

End-to-end tests (run build before tests):

```bash
npm run build && npm test
```

### Roadmap
- [ ] Support for MCP servers config
- [ ] Support for transforming and rewriting the rules using AI
- [ ] Support "harmonisation" (reading existing rules of specific agents and combining them with the master config)
- [ ] Support for additional agents
- [ ] Support for agent-specific features (for example: apply rules in copilot)

## Contributing

Contributions are welcome! Please open issues or pull requests on GitHub.

## License

MIT

---

© Eleanor Berger

[ai.intellectronica.net](https://ai.intellectronica.net/)
