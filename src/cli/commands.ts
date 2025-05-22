import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { applyAllAgentConfigs } from '../lib';
import * as path from 'path';
import { promises as fs } from 'fs';

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
            'Comma-separated list of agent names to include (e.g. "copilot,claude")',
        });
        y.option('config', {
          type: 'string',
          description: 'Path to TOML configuration file',
        });
      },
      async (argv) => {
        const projectRoot = argv['project-root'] as string;
        const agents = argv.agents
          ? (argv.agents as string).split(',').map((a) => a.trim())
          : undefined;
        const configPath = argv.config as string | undefined;
        try {
          await applyAllAgentConfigs(projectRoot, agents, configPath);
          console.log('Ruler apply completed successfully.');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('Error applying ruler configurations:', message);
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
        });
      },
      async (argv) => {
        const projectRoot = argv['project-root'] as string;
        const rulerDir = path.join(projectRoot, '.ruler');
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
# default_agents = ["Copilot", "Claude"]

# --- Agent Specific Configurations ---
# You can enable/disable agents and override their default output paths here.

# [agents.GitHubCopilot]
# enabled = true
# output_path = ".github/copilot-instructions.md"

# [agents.ClaudeCode]
# enabled = true
# output_path = "CLAUDE.md"

# [agents.OpenAICodexCLI]
# enabled = true
# output_path = "AGENTS.md"

# [agents.Cursor]
# enabled = true
# output_path = ".cursor/rules/ruler_cursor_instructions.md"

# [agents.Windsurf]
# enabled = true
# output_path = ".windsurf/rules/ruler_windsurf_instructions.md"

# [agents.Cline]
# enabled = true
# output_path = ".clinerules"

# [agents.Aider]
# enabled = true
# output_path_instructions = "ruler_aider_instructions.md"
# output_path_config = ".aider.conf.yml"
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
      },
    )
    .demandCommand(1, 'You need to specify a command')
    .help()
    .strict()
    .parse();
}
