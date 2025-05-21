# Ruler

A CLI tool to manage custom rules and configs across different AI coding agents.

## Features

- Centralise AI agent instructions in a single `.ruler/` directory
- Distribute concatenated rules to supported agents (GitHub Copilot, Claude Code, OpenAI Codex CLI, Cursor, Windsurf, Cline, Aider)
- Backup existing config files before overwriting
- Extensible architecture: add new agent adapters easily
- Comprehensive test suite (unit and end-to-end)
- CI/CD workflows for automated testing and publishing to npm

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
ruler apply [--project-root <path>]
```

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

## Contributing

Contributions are welcome! Please open issues or pull requests on GitHub.

## License

MIT © Eleanor Berger