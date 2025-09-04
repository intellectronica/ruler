# Ruler: Centralise Your AI Coding Assistant Instructions

<table style="width:100%">
  <tr>
    <td style="vertical-align: top;">
      <p>
        <a href="https://github.com/intellectronica/ruler/actions/workflows/ci.yml"><img src="https://github.com/intellectronica/ruler/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
        <a href="https://www.npmjs.com/package/@intellectronica/ruler"><img src="https://badge.fury.io/js/%40intellectronica%2Fruler.svg" alt="npm version"></a>
        <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
      </p>
      <ul>
        <li><strong>GitHub</strong>: <a href="https://github.com/intellectronica/ruler">intellectronica/ruler</a></li>
        <li><strong>NPM</strong>: <a href="https://www.npmjs.com/package/@intellectronica/ruler">@intellectronica/ruler</a></li>
      </ul>
      <hr />
      <p>
        <em>Animation by <a href="https://isaacflath.com/">Isaac Flath</a> of <strong><a href="https://elite-ai-assisted-coding.dev/">Elite AI-Assisted Coding</a></strong></em> ➡︎
      </p>
    </td>
    <td style="vertical-align: top; width:33%;">
      <img src="img/ruler-short.gif" alt="Ruler demo" style="width:300px; height:auto; display:block;" />
    </td>
  </tr>
</table>

---

> **Beta Research Preview**
>
> - Please test this version carefully in your environment
> - Report issues at https://github.com/intellectronica/ruler/issues

## Why Ruler?

Managing instructions across multiple AI coding tools becomes complex as your team grows. Different agents (GitHub Copilot, Claude, Cursor, Aider, etc.) require their own configuration files, leading to:

- **Inconsistent guidance** across AI tools
- **Duplicated effort** maintaining multiple config files
- **Context drift** as project requirements evolve
- **Onboarding friction** for new AI tools
- **Complex project structures** requiring context-specific instructions for different components

Ruler solves this by providing a **single source of truth** for all your AI agent instructions, automatically distributing them to the right configuration files. With support for **nested rule loading**, Ruler can handle complex project structures with context-specific instructions for different components.

## Core Features

- **Centralised Rule Management**: Store all AI instructions in a dedicated `.ruler/` directory using Markdown files
- **Nested Rule Loading**: Support complex project structures with multiple `.ruler/` directories for context-specific instructions
- **Automatic Distribution**: Ruler applies these rules to configuration files of supported AI agents
- **Targeted Agent Configuration**: Fine-tune which agents are affected and their specific output paths via `ruler.toml`
- **MCP Server Propagation**: Manage and distribute Model Context Protocol (MCP) server settings
- **`.gitignore` Automation**: Keeps generated agent config files out of version control automatically
- **Simple CLI**: Easy-to-use commands for initialising and applying configurations

## Supported AI Agents

| Agent            | Rules File(s)                                    | MCP Configuration / Notes                        |
| ---------------- | ------------------------------------------------ | ------------------------------------------------ |
| AGENTS.md        | `AGENTS.md`                                      | (pseudo-agent ensuring root `AGENTS.md` exists)  |
| GitHub Copilot   | `.github/copilot-instructions.md`                | `.vscode/mcp.json`                               |
| Claude Code      | `CLAUDE.md`                                      | `.mcp.json`                                      |
| OpenAI Codex CLI | `AGENTS.md`                                      | `.codex/config.toml`                             |
| Jules            | `AGENTS.md`                                      | -                                                |
| Cursor           | `.cursor/rules/ruler_cursor_instructions.mdc`    | `.cursor/mcp.json`                               |
| Windsurf         | `.windsurf/rules/ruler_windsurf_instructions.md` | -                                                |
| Cline            | `.clinerules`                                    | -                                                |
| Crush            | `CRUSH.md`                                       | `.crush.json`                                    |
| Amp              | `AGENTS.md`                                      | -                                                |
| Amazon Q CLI     | `.amazonq/rules/ruler_q_rules.md`                | `.amazonq/mcp.json`                              |
| Aider            | `AGENTS.md`, `.aider.conf.yml`                   | `.mcp.json`                                      |
| Firebase Studio  | `.idx/airules.md`                                | -                                                |
| Open Hands       | `.openhands/microagents/repo.md`                 | `.openhands/config.toml`                         |
| Gemini CLI       | `AGENTS.md`                                      | `.gemini/settings.json`                          |
| Junie            | `.junie/guidelines.md`                           | -                                                |
| AugmentCode      | `.augment/rules/ruler_augment_instructions.md`   | `.vscode/settings.json`                          |
| Kilo Code        | `.kilocode/rules/ruler_kilocode_instructions.md` | `.kilocode/mcp.json`                             |
| opencode         | `AGENTS.md`                                      | `opencode.json`                                  |
| Goose            | `.goosehints`                                    | -                                                |
| Qwen Code        | `AGENTS.md`                                      | `.qwen/settings.json`                            |
| RooCode          | `AGENTS.md`                                      | `.roo/mcp.json`                                  |
| Zed              | `AGENTS.md`                                      | `.zed/settings.json` (project root, never $HOME) |
| Trae AI          | `.trae/rules/project_rules.md`                   | -                                                |
| Warp             | `WARP.md`                                        | -                                                |
| Kiro             | `.kiro/steering/ruler_kiro_instructions.md`      | -                                                |

## Getting Started

### Prerequisites

Node.js 18.x or higher is required.

### Installation

**Global Installation (Recommended for CLI use):**

```bash
npm install -g @intellectronica/ruler
```

**Using `npx` (for one-off commands):**

```bash
npx @intellectronica/ruler apply
```

### Project Initialisation

1. Navigate to your project's root directory
2. Run `ruler init`
3. This creates:
  - `.ruler/` directory
  - `.ruler/AGENTS.md`: The primary starter Markdown file for your rules
  - `.ruler/ruler.toml`: The main configuration file for Ruler (now contains sample MCP server sections; legacy `.ruler/mcp.json` no longer scaffolded)
  - (Optional legacy fallback) If you previously used `.ruler/instructions.md`, it is still respected when `AGENTS.md` is absent. (The prior runtime warning was removed.)

Additionally, you can create a global configuration to use when no local `.ruler/` directory is found:

```bash
ruler init --global
```

The global configuration will be created to `$XDG_CONFIG_HOME/ruler` (default: `~/.config/ruler`).

## Core Concepts

### The `.ruler/` Directory

This is your central hub for all AI agent instructions:

- **Primary File Order & Precedence**:
  1. A repository root `AGENTS.md` (outside `.ruler/`) if present (highest precedence, prepended)
  2. `.ruler/AGENTS.md` (new default starter file)
  3. Legacy `.ruler/instructions.md` (only if `.ruler/AGENTS.md` absent; no longer emits a deprecation warning)
  4. Remaining discovered `.md` files under `.ruler/` (and subdirectories) in sorted order
- **Rule Files (`*.md`)**: Discovered recursively from `.ruler/` or `$XDG_CONFIG_HOME/ruler` and concatenated in the order above
- **Concatenation Marker**: Each file's content is prepended with `--- Source: <relative_path_to_md_file> ---` for traceability
- **`ruler.toml`**: Master configuration for Ruler's behavior, agent selection, and output paths
- **`mcp.json`**: Shared MCP server settings

This ordering lets you keep a short, high-impact root `AGENTS.md` (e.g. executive project summary) while housing detailed guidance inside `.ruler/`.

### Nested Rule Loading

Ruler now supports **nested rule loading** with the `--nested` flag, enabling context-specific instructions for different parts of your project:

```
project/
├── .ruler/           # Global project rules
│   ├── AGENTS.md
│   └── coding_style.md
├── src/
│   └── .ruler/       # Component-specific rules
│       └── api_guidelines.md
├── tests/
│   └── .ruler/       # Test-specific rules
│       └── testing_conventions.md
└── docs/
    └── .ruler/       # Documentation rules
        └── writing_style.md
```

**How it works:**

- Discover all `.ruler/` directories in the project hierarchy
- Load and concatenate rules from each directory in order
- Enable with: `ruler apply --nested`

**Perfect for:**

- Monorepos with multiple services
- Projects with distinct components (frontend/backend)
- Teams needing different instructions for different areas
- Complex codebases with varying standards

### Best Practices for Rule Files

**Granularity**: Break down complex instructions into focused `.md` files:

- `coding_style.md`
- `api_conventions.md`
- `project_architecture.md`
- `security_guidelines.md`

**Example rule file (`.ruler/python_guidelines.md`):**

```markdown
# Python Project Guidelines

## General Style

- Follow PEP 8 for all Python code
- Use type hints for all function signatures and complex variables
- Keep functions short and focused on a single task

## Error Handling

- Use specific exception types rather than generic `Exception`
- Log errors effectively with context

## Security

- Always validate and sanitize user input
- Be mindful of potential injection vulnerabilities
```

## Usage: The `apply` Command

### Primary Command

```bash
ruler apply [options]
```

The `apply` command looks for `.ruler/` in the current directory tree, reading the first match. If no such directory is found, it will look for a global configuration in `$XDG_CONFIG_HOME/ruler`.

### Options

| Option                         | Description                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--project-root <path>`        | Path to your project's root (default: current directory)                                                                                                                        |
| `--agents <agent1,agent2,...>` | Comma-separated list of agent names to target (amp, copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush, zed, qwen, trae) |
| `--config <path>`              | Path to a custom `ruler.toml` configuration file                                                                                                                                |
| `--mcp` / `--with-mcp`         | Enable applying MCP server configurations (default: true)                                                                                                                       |
| `--no-mcp`                     | Disable applying MCP server configurations                                                                                                                                      |
| `--mcp-overwrite`              | Overwrite native MCP config entirely instead of merging                                                                                                                         |
| `--gitignore`                  | Enable automatic .gitignore updates (default: true)                                                                                                                             |
| `--no-gitignore`               | Disable automatic .gitignore updates                                                                                                                                            |
| `--local-only`                 | Do not look for configuration in `$XDG_CONFIG_HOME`                                                                                                                             |
| `--nested`                     | Enable nested rule loading from nested .ruler directories (default: disabled)                                                                                                  |
| `--dry-run`                    | Preview changes without writing files (default: false)                                                                                                                          |
| `--backup`                     | Enable/disable creation of .bak backup files (default: enabled)                                                                                                                |
| `--verbose` / `-v`             | Display detailed output during execution                                                                                                                                        |

### Common Examples

**Apply rules to all configured agents:**

```bash
ruler apply
```

**Apply rules only to GitHub Copilot and Claude:**

```bash
ruler apply --agents copilot,claude
```

**Apply rules only to Firebase Studio:**

```bash
ruler apply --agents firebase
```

**Apply rules only to Warp:**

```bash
ruler apply --agents warp
```

**Apply rules only to Trae AI:**

```bash
ruler apply --agents trae
```

**Apply rules only to RooCode:**

```bash
ruler apply --agents roo
```

**Use a specific configuration file:**

```bash
ruler apply --config ./team-configs/ruler.frontend.toml
```

**Apply rules with verbose output:**

```bash
ruler apply --verbose
```

**Apply rules but skip MCP and .gitignore updates:**

```bash
ruler apply --no-mcp --no-gitignore
```

## Usage: The `revert` Command

The `revert` command safely undoes all changes made by `ruler apply`, restoring your project to its pre-ruler state. It intelligently restores files from backups (`.bak` files) when available, or removes generated files that didn't exist before.

### Why Revert is Needed

When experimenting with different rule configurations or switching between projects, you may want to:

- **Clean slate**: Remove all ruler-generated files to start fresh
- **Restore originals**: Revert modified files back to their original state
- **Selective cleanup**: Remove configurations for specific agents only
- **Safe experimentation**: Try ruler without fear of permanent changes

### Primary Command

```bash
ruler revert [options]
```

### Options

| Option                         | Description                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--project-root <path>`        | Path to your project's root (default: current directory)                                                                                                                     |
| `--agents <agent1,agent2,...>` | Comma-separated list of agent names to revert (amp, copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush, zed, qwen, trae) |
| `--config <path>`              | Path to a custom `ruler.toml` configuration file                                                                                                                             |
| `--keep-backups`               | Keep backup files (.bak) after restoration (default: false)                                                                                                                  |
| `--dry-run`                    | Preview changes without actually reverting files                                                                                                                             |
| `--verbose` / `-v`             | Display detailed output during execution                                                                                                                                     |
| `--local-only`                 | Only search for local .ruler directories, ignore global config                                                                                                               |

### Common Examples

**Revert all ruler changes:**

```bash
ruler revert
```

**Preview what would be reverted (dry-run):**

```bash
ruler revert --dry-run
```

**Revert only specific agents:**

```bash
ruler revert --agents claude,copilot
```

**Revert with detailed output:**

```bash
ruler revert --verbose
```

**Keep backup files after reverting:**

```bash
ruler revert --keep-backups
```

## Configuration (`ruler.toml`) in Detail

### Location

Defaults to `.ruler/ruler.toml` in the project root. Override with `--config` CLI option.

### Complete Example

```toml
# Default agents to run when --agents is not specified
# Uses case-insensitive substring matching
default_agents = ["copilot", "claude", "aider"]

# --- Global MCP Server Configuration ---
[mcp]
# Enable/disable MCP propagation globally (default: true)
enabled = true
# Global merge strategy: 'merge' or 'overwrite' (default: 'merge')
merge_strategy = "merge"

# --- MCP Server Definitions ---
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]

[mcp_servers.git]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-git", "--repository", "."]

[mcp_servers.remote_api]
url = "https://api.example.com"

[mcp_servers.remote_api.headers]
Authorization = "Bearer your-token"

# --- Global .gitignore Configuration ---
[gitignore]
# Enable/disable automatic .gitignore updates (default: true)
enabled = true

# --- Agent-Specific Configurations ---
[agents.copilot]
enabled = true
output_path = ".github/copilot-instructions.md"

[agents.claude]
enabled = true
output_path = "CLAUDE.md"

[agents.aider]
enabled = true
output_path_instructions = "AGENTS.md"
output_path_config = ".aider.conf.yml"

# OpenAI Codex CLI agent and MCP config
[agents.codex]
enabled = true
output_path = "AGENTS.md"
output_path_config = ".codex/config.toml"

# Agent-specific MCP configuration for Codex CLI
[agents.codex.mcp]
enabled = true
merge_strategy = "merge"

[agents.firebase]
enabled = true
output_path = ".idx/airules.md"

[agents.gemini-cli]
enabled = true

[agents.jules]
enabled = true

[agents.junie]
enabled = true
output_path = ".junie/guidelines.md"

# Agent-specific MCP configuration
[agents.cursor.mcp]
enabled = true
merge_strategy = "merge"

# Disable specific agents
[agents.windsurf]
enabled = false

[agents.kilocode]
enabled = true
output_path = ".kilocode/rules/ruler_kilocode_instructions.md"

[agents.warp]
enabled = true
output_path = "WARP.md"
```

### Configuration Precedence

1. **CLI flags** (e.g., `--agents`, `--no-mcp`, `--mcp-overwrite`, `--no-gitignore`)
2. **Settings in `ruler.toml`** (`default_agents`, specific agent settings, global sections)
3. **Ruler's built-in defaults** (all agents enabled, standard output paths, MCP enabled with 'merge')

## MCP (Model Context Protocol) Server Configuration

MCP provides broader context to AI models through server configurations. Ruler can manage and distribute these settings across compatible agents.

### TOML Configuration (Recommended)

You can now define MCP servers directly in `ruler.toml` using the `[mcp_servers.<name>]` syntax:

```toml
# Global MCP behavior
[mcp]
enabled = true
merge_strategy = "merge"  # or "overwrite"

# Local (stdio) server
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]

[mcp_servers.filesystem.env]
API_KEY = "your-api-key"

# Remote server
[mcp_servers.search]
url = "https://mcp.example.com"

[mcp_servers.search.headers]
Authorization = "Bearer your-token"
"X-API-Version" = "v1"
```

### Legacy `.ruler/mcp.json` (Deprecated)

For backward compatibility, you can still use the JSON format; a warning is issued encouraging migration to TOML. The file is no longer created during `ruler init`.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/project"
      ]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "."]
    }
  }
}
```

### Configuration Precedence

When both TOML and JSON configurations are present:

1. **TOML servers take precedence** over JSON servers with the same name
2. **Servers are merged** from both sources (unless using overwrite strategy)
3. **Deprecation warning** is shown encouraging migration to TOML (warning shown once per run)

### Server Types

**Local/stdio servers** require a `command` field:

```toml
[mcp_servers.local_server]
command = "node"
args = ["server.js"]

[mcp_servers.local_server.env]
DEBUG = "1"
```

**Remote servers** require a `url` field (headers optional; bearer Authorization token auto-extracted for OpenHands when possible):
```toml
[mcp_servers.remote_server]
url = "https://api.example.com"

[mcp_servers.remote_server.headers]
Authorization = "Bearer token"
```

Ruler uses this configuration with the `merge` (default) or `overwrite` strategy, controlled by `ruler.toml` or CLI flags.

**Home Directory Safety:** Ruler never writes MCP configuration files outside your project root. Any historical references to user home directories (e.g. `~/.codeium/windsurf/mcp_config.json` or `~/.zed/settings.json`) have been removed; only project-local paths are targeted.

**Note for OpenAI Codex CLI:** To apply the local Codex CLI MCP configuration, set the `CODEX_HOME` environment variable to your project’s `.codex` directory:

```bash
export CODEX_HOME="$(pwd)/.codex"
```

## `.gitignore` Integration

Ruler automatically manages your `.gitignore` file to keep generated agent configuration files out of version control.

### How it Works

- Creates or updates `.gitignore` in your project root
- Adds paths to a managed block marked with `# START Ruler Generated Files` and `# END Ruler Generated Files`
- Preserves existing content outside this block
- Sorts paths alphabetically and uses relative POSIX-style paths

### Example `.gitignore` Section (sample - actual list depends on enabled agents)

```gitignore
# Your existing rules
node_modules/
*.log

# START Ruler Generated Files
.aider.conf.yml
.clinerules
.cursor/rules/ruler_cursor_instructions.mdc
.github/copilot-instructions.md
.windsurf/rules/ruler_windsurf_instructions.md
AGENTS.md
CLAUDE.md
AGENTS.md
# END Ruler Generated Files

dist/
```

### Control Options

- **CLI flags**: `--gitignore` or `--no-gitignore`
- **Configuration**: `[gitignore].enabled` in `ruler.toml`
- **Default**: enabled

## Practical Usage Scenarios

### Scenario 1: Getting Started Quickly

```bash
# Initialize Ruler in your project
cd your-project
ruler init

# Edit the generated files
# - Add your coding guidelines to .ruler/AGENTS.md (or keep adding additional .md files)
# - Customize .ruler/ruler.toml if needed

# Apply rules to all AI agents
ruler apply
```

### Scenario 2: Complex Projects with Nested Rules

For large projects with multiple components or services, use nested rule loading:

```bash
# Set up nested .ruler directories
mkdir -p src/.ruler tests/.ruler docs/.ruler

# Add component-specific instructions
echo "# API Design Guidelines" > src/.ruler/api_rules.md
echo "# Testing Best Practices" > tests/.ruler/test_rules.md
echo "# Documentation Standards" > docs/.ruler/docs_rules.md

# Apply with nested loading
ruler apply --nested --verbose
```

This creates context-specific instructions for different parts of your project while maintaining global rules in the root `.ruler/` directory.

### Scenario 3: Team Standardization

1. Create `.ruler/coding_standards.md`, `.ruler/api_usage.md`
2. Commit the `.ruler` directory to your repository
3. Team members pull changes and run `ruler apply` to update their local AI agent configurations

### Scenario 3: Project-Specific Context for AI

1. Detail your project's architecture in `.ruler/project_overview.md`
2. Describe primary data structures in `.ruler/data_models.md`
3. Run `ruler apply` to help AI tools provide more relevant suggestions

### Integration with NPM Scripts

```json
{
  "scripts": {
    "ruler:apply": "ruler apply",
    "dev": "npm run ruler:apply && your_dev_command",
    "precommit": "npm run ruler:apply"
  }
}
```

### Integration with GitHub Actions

```yaml
# .github/workflows/ruler-check.yml
name: Check Ruler Configuration
on:
  pull_request:
    paths: ['.ruler/**']

jobs:
  check-ruler:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Ruler
        run: npm install -g @intellectronica/ruler

      - name: Apply Ruler configuration
        run: ruler apply --no-gitignore

      - name: Check for uncommitted changes
        run: |
          if [[ -n $(git status --porcelain) ]]; then
            echo "::error::Ruler configuration is out of sync!"
            echo "Please run 'ruler apply' locally and commit the changes."
            exit 1
          fi
```

## Troubleshooting

### Common Issues

**"Cannot find module" errors:**

- Ensure Ruler is installed globally: `npm install -g @intellectronica/ruler`
- Or use `npx @intellectronica/ruler`

**Permission denied errors:**

- On Unix systems, you may need `sudo` for global installation

**Agent files not updating:**

- Check if the agent is enabled in `ruler.toml`
- Verify agent isn't excluded by `--agents` flag
- Use `--verbose` to see detailed execution logs

**Configuration validation errors:**

- Ruler now validates `ruler.toml` format and will show specific error details
- Check that all configuration values match the expected types and formats

### Debug Mode

Use `--verbose` flag to see detailed execution logs:

```bash
ruler apply --verbose
```

This shows:

- Configuration loading details
- Agent selection logic
- File processing information
- MCP configuration steps

## FAQ

**Q: Can I use different rules for different agents?**
A: Currently, all agents receive the same concatenated rules. For agent-specific instructions, include sections in your rule files like "## GitHub Copilot Specific" or "## Aider Configuration".

**Q: How do I set up different instructions for different parts of my project?**
A: Use the `--nested` flag with `ruler apply --nested`. This enables Ruler to discover and load rules from multiple `.ruler/` directories throughout your project hierarchy. Place component-specific instructions in `src/.ruler/`, test-specific rules in `tests/.ruler/`, etc., while keeping global rules in the root `.ruler/` directory.

**Q: How do I temporarily disable Ruler for an agent?**
A: Set `enabled = false` in `ruler.toml` under `[agents.agentname]`, or use `--agents` flag to specify only the agents you want.

**Q: What happens to my existing agent configuration files?**
A: Ruler creates backups with `.bak` extension before overwriting any existing files.

**Q: Can I run Ruler in CI/CD pipelines?**
A: Yes! Use `ruler apply --no-gitignore` in CI to avoid modifying `.gitignore`. See the GitHub Actions example above.

**Q: How do I migrate from older versions using `instructions.md`?**
A: Simply rename `.ruler/instructions.md` to `.ruler/AGENTS.md` (recommended). If you keep the legacy file and omit `AGENTS.md`, Ruler will still use it (without emitting the old deprecation warning). Having both causes `AGENTS.md` to take precedence; the legacy file is still concatenated afterward.

**Q: How does OpenHands MCP propagation classify servers?**
A: Local stdio servers become `stdio_servers`. Remote URLs containing `/sse` are classified as `sse_servers`; others become `shttp_servers`. Bearer tokens in an `Authorization` header are extracted into `api_key` where possible.

**Q: Where is Zed configuration written now?**
A: Ruler writes a `settings.json` in the project root (not the user home dir) and transforms MCP server definitions to Zed's `context_servers` format including `source: "custom"`.

**Q: What changed about MCP initialization?**
A: `ruler init` now only adds example MCP server sections to `ruler.toml` instead of creating `.ruler/mcp.json`. The JSON file is still consumed if present, but TOML servers win on name conflicts.

**Q: Is Kiro supported?**
A: Yes. Kiro receives concatenated rules at `.kiro/steering/ruler_kiro_instructions.md`.

## Development

### Setup

```bash
git clone https://github.com/intellectronica/ruler.git
cd ruler
npm install
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Run linting
npm run lint

# Run formatting
npm run format
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

For bugs and feature requests, please [open an issue](https://github.com/intellectronica/ruler/issues).

## License

MIT

---

## Development and Testing

### Running Tests

The project includes comprehensive test coverage with unit, integration, and end-to-end tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests specifically
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Integration Testing

The project includes comprehensive integration tests that validate the complete CLI workflow:

- **`npm run test:integration`**: Runs a full end-to-end integration test that:
  1. Creates a temporary test directory
  2. Runs `ruler init` to set up the initial structure
  3. Creates custom `ruler.toml` with MCP servers (both stdio and remote)
  4. Creates sample `AGENTS.md` and additional markdown files for concatenation
  5. Runs `ruler apply` to generate all agent configuration files
  6. Inspects and validates all generated files contain expected content
  7. Outputs the content of all generated files for manual verification
  8. Validates MCP server configurations were properly applied

This integration test ensures the entire CLI workflow functions correctly and can be used for manual testing or CI validation.

---

© Eleanor Berger  
[ai.intellectronica.net](https://ai.intellectronica.net/)
