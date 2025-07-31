import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { applyAllAgentConfigs } from '../lib';
import { revertAllAgentConfigs } from '../revert';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { ERROR_PREFIX } from '../constants';

/**
 * Sets up and parses CLI commands.
 */
export function run(): void {
  yargs(hideBin(process.argv))
    .scriptName('ruler')
    .usage('$0 <command> [options]')
    .command(
      'apply',
      'Apply ruler configurations to supported AI agents',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        });
        y.option('agents', {
          type: 'string',
          description:
            'Comma-separated list of agent identifiers: copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush',
        });
        y.option('config', {
          type: 'string',
          description: 'Path to TOML configuration file',
        });
        y.option('mcp', {
          type: 'boolean',
          description: 'Enable or disable applying MCP server config',
          default: true,
        });
        y.alias('mcp', 'with-mcp');
        y.option('mcp-overwrite', {
          type: 'boolean',
          description: 'Replace (not merge) the native MCP config(s)',
          default: false,
        });
        y.option('gitignore', {
          type: 'boolean',
          description:
            'Enable/disable automatic .gitignore updates (default: enabled)',
        });
        y.option('verbose', {
          type: 'boolean',
          description: 'Enable verbose logging',
          default: false,
        });
        y.alias('verbose', 'v');
        y.option('dry-run', {
          type: 'boolean',
          description: 'Preview changes without writing files',
          default: false,
        });
        y.option('local-only', {
          type: 'boolean',
          description:
            'Only search for local .ruler directories, ignore global config',
          default: false,
        });
      },
      async (argv) => {
        const projectRoot = argv['project-root'] as string;
        const agents = argv.agents
          ? (argv.agents as string).split(',').map((a) => a.trim())
          : undefined;
        const configPath = argv.config as string | undefined;
        const mcpEnabled = argv.mcp as boolean;
        const mcpStrategy = (argv['mcp-overwrite'] as boolean)
          ? 'overwrite'
          : undefined;
        const verbose = argv.verbose as boolean;
        const dryRun = argv['dry-run'] as boolean;
        const localOnly = argv['local-only'] as boolean;

        // Determine gitignore preference: CLI > TOML > Default (enabled)
        // yargs handles --no-gitignore by setting gitignore to false
        let gitignorePreference: boolean | undefined;
        if (argv.gitignore !== undefined) {
          gitignorePreference = argv.gitignore as boolean;
        } else {
          gitignorePreference = undefined; // Let TOML/default decide
        }
        try {
          await applyAllAgentConfigs(
            projectRoot,
            agents,
            configPath,
            mcpEnabled,
            mcpStrategy,
            gitignorePreference,
            verbose,
            dryRun,
            localOnly,
          );
          console.log('Ruler apply completed successfully.');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${ERROR_PREFIX} ${message}`);
          process.exit(1);
        }
      },
    )
    .command(
      'init',
      'Scaffold a .ruler directory with default files',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        }).option('global', {
          type: 'boolean',
          description:
            'Initialize in global config directory (XDG_CONFIG_HOME/ruler)',
          default: false,
        });
      },
      async (argv) => {
        const projectRoot = argv['project-root'] as string;
        const isGlobal = argv['global'] as boolean;

        const rulerDir = isGlobal
          ? path.join(
              process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
              'ruler',
            )
          : path.join(projectRoot, '.ruler');
        await fs.mkdir(rulerDir, { recursive: true });
        const instructionsPath = path.join(rulerDir, 'instructions.md');
        const tomlPath = path.join(rulerDir, 'ruler.toml');
        const exists = async (p: string) => {
          try {
            await fs.access(p);
            return true;
          } catch {
            return false;
          }
        };
        const DEFAULT_INSTRUCTIONS = `# Ruler Instructions

These are your centralised AI agent instructions.
Add your coding guidelines, style guides, and other project-specific context here.

Ruler will concatenate all .md files in this directory (and its subdirectories)
and apply them to your configured AI coding agents.
`;
        const DEFAULT_TOML = `# Ruler Configuration File
# See https://ai.intellectronica.net/ruler for documentation.

# To specify which agents are active by default when --agents is not used,
# uncomment and populate the following line. If omitted, all agents are active.
# default_agents = ["copilot", "claude"]

# --- Agent Specific Configurations ---
# You can enable/disable agents and override their default output paths here.
# Use lowercase agent identifiers: copilot, claude, codex, cursor, windsurf, cline, aider, kilocode

# [agents.copilot]
# enabled = true
# output_path = ".github/copilot-instructions.md"

# [agents.claude]
# enabled = true
# output_path = "CLAUDE.md"

# [agents.codex]
# enabled = true
# output_path = "AGENTS.md"

# [agents.cursor]
# enabled = true
# output_path = ".cursor/rules/ruler_cursor_instructions.mdc"

# [agents.windsurf]
# enabled = true
# output_path = ".windsurf/rules/ruler_windsurf_instructions.md"

# [agents.cline]
# enabled = true
# output_path = ".clinerules"

# [agents.aider]
# enabled = true
# output_path_instructions = "ruler_aider_instructions.md"
# output_path_config = ".aider.conf.yml"

# [agents.firebase]
# enabled = true
# output_path = ".idx/airules.md"

# [agents.gemini-cli]
# enabled = true

# [agents.kilocode]
# enabled = true
# output_path = ".kilocode/rules/ruler_kilocode_instructions.md"
`;
        if (!(await exists(instructionsPath))) {
          await fs.writeFile(instructionsPath, DEFAULT_INSTRUCTIONS);
          console.log(`[ruler] Created ${instructionsPath}`);
        } else {
          console.log(`[ruler] instructions.md already exists, skipping`);
        }
        if (!(await exists(tomlPath))) {
          await fs.writeFile(tomlPath, DEFAULT_TOML);
          console.log(`[ruler] Created ${tomlPath}`);
        } else {
          console.log(`[ruler] ruler.toml already exists, skipping`);
        }
        const mcpPath = path.join(rulerDir, 'mcp.json');
        const DEFAULT_MCP_JSON = `{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com"
    }
  }
}`;
        if (!(await exists(mcpPath))) {
          await fs.writeFile(mcpPath, DEFAULT_MCP_JSON);
          console.log(`[ruler] Created ${mcpPath}`);
        } else {
          console.log(`[ruler] mcp.json already exists, skipping`);
        }
      },
    )
    .command(
      'revert',
      'Revert ruler configurations by restoring backups and removing generated files',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        });
        y.option('agents', {
          type: 'string',
          description:
            'Comma-separated list of agent identifiers: copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush',
        });
        y.option('config', {
          type: 'string',
          description: 'Path to TOML configuration file',
        });
        y.option('keep-backups', {
          type: 'boolean',
          description: 'Keep backup files (.bak) after restoration',
          default: false,
        });
        y.option('verbose', {
          type: 'boolean',
          description: 'Enable verbose logging',
          default: false,
        });
        y.alias('verbose', 'v');
        y.option('dry-run', {
          type: 'boolean',
          description: 'Preview changes without actually reverting files',
          default: false,
        });
        y.option('local-only', {
          type: 'boolean',
          description:
            'Only search for local .ruler directories, ignore global config',
          default: false,
        });
      },
      async (argv) => {
        const projectRoot = argv['project-root'] as string;
        const agents = argv.agents
          ? (argv.agents as string).split(',').map((a) => a.trim())
          : undefined;
        const configPath = argv.config as string | undefined;
        const keepBackups = argv['keep-backups'] as boolean;
        const verbose = argv.verbose as boolean;
        const dryRun = argv['dry-run'] as boolean;
        const localOnly = argv['local-only'] as boolean;

        try {
          await revertAllAgentConfigs(
            projectRoot,
            agents,
            configPath,
            keepBackups,
            verbose,
            dryRun,
            localOnly,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${ERROR_PREFIX} ${message}`);
          process.exit(1);
        }
      },
    )
    .demandCommand(1, 'You need to specify a command')
    .help()
    .strict()
    .parse();
}
