> **Experimental Research Preview**
> - Please test this version with caution in your own setup
> - File issues at https://github.com/intellectronica/ruler/issues

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
ruler apply [--project-root <path>] [--agents <agent1,agent2,...>] [--config <path>]
```


Run the init command to scaffold a basic `.ruler/` setup:

```bash
ruler init [--project-root <path>]
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

## Configuration

Ruler uses a TOML configuration file located at `.ruler/ruler.toml` by default. You can override its location with the `--config <path>` option in the `apply` command.

### Configuration structure

```toml
# Run only these agents by default (omit to use all agents)
# default_agents = ["GitHub Copilot", "Claude Code", "Aider"]

[agents.Copilot]
enabled = true
output_path = ".github/copilot-instructions.md"

[agents.Claude]
enabled = true
# output_path = "CLAUDE.md"

[agents.Aider]
enabled = false
# output_path_instructions = "ruler_aider_instructions.md"
# output_path_config = ".aider.conf.yml"
```

- `default_agents`: array of agent names (case-insensitive substrings) to run by default.
- `[agents.<AgentName>]`: per-agent settings:
  - `enabled` (boolean): enable or disable this agent.
  - `output_path` (string): custom path for agents that produce a single file.
  - `output_path_instructions`/`output_path_config`: custom paths for Aider's instruction and config files.

### Precedence

1. CLI `--agents` option (substring filters)
2. Config file `default_agents` and `[agents]` overrides
3. Built-in defaults (all agents enabled, standard output paths)

## MCP servers

Ruler can propagate a project-level `.ruler/mcp.json` file to native MCP configurations of supported agents, merging (or overwriting) each agent’s existing MCP server settings.

### `.ruler/mcp.json`

Place your MCP servers config in a file at `.ruler/mcp.json`:

```json
{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com"
    }
  }
}
```

### CLI flags

| Flag              | Effect                                                       |
|-------------------|--------------------------------------------------------------|
| `--with-mcp`      | Enable writing MCP configs for all agents (default)          |
| `--no-mcp`        | Disable writing MCP configs                                 |
| `--mcp-overwrite` | Overwrite native MCP configs instead of merging              |

### Configuration (`ruler.toml`)

Configure default behavior in your `ruler.toml`:

```toml
[mcp]
enabled = true
merge_strategy = "merge"  # or "overwrite"

[agents.Cursor.mcp]
enabled = false
merge_strategy = "overwrite"
```

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
