import { applyAllAgentConfigs } from '../lib';
import { revertAllAgentConfigs } from '../revert';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { ERROR_PREFIX, DEFAULT_RULES_FILENAME } from '../constants';
import { McpStrategy } from '../types';
import { loadConfig } from '../core/ConfigLoader';

export interface ApplyArgs {
  'project-root': string;
  agents?: string;
  config?: string;
  mcp: boolean;
  'mcp-overwrite': boolean;
  gitignore?: boolean;
  verbose: boolean;
  'dry-run': boolean;
  'local-only': boolean;
  nested?: boolean;
  backup: boolean;
  skills?: boolean;
}

export interface InitArgs {
  'project-root': string;
  global: boolean;
}

export interface RevertArgs {
  'project-root': string;
  agents?: string;
  config?: string;
  'keep-backups': boolean;
  verbose: boolean;
  'dry-run': boolean;
  'local-only': boolean;
}

/**
 * Handler for the 'apply' command.
 */
export async function applyHandler(argv: ApplyArgs): Promise<void> {
  const projectRoot = argv['project-root'];
  const agents = argv.agents
    ? argv.agents.split(',').map((a) => a.trim())
    : undefined;
  const configPath = argv.config;
  const mcpEnabled = argv.mcp;
  const mcpStrategy: McpStrategy | undefined = argv['mcp-overwrite']
    ? 'overwrite'
    : undefined;
  const verbose = argv.verbose;
  const dryRun = argv['dry-run'];
  const localOnly = argv['local-only'];
  const backup = argv.backup;

  // Determine gitignore preference: CLI > TOML > Default (enabled)
  // yargs handles --no-gitignore by setting gitignore to false
  let gitignorePreference: boolean | undefined;
  if (argv.gitignore !== undefined) {
    gitignorePreference = argv.gitignore;
  } else {
    gitignorePreference = undefined; // Let TOML/default decide
  }

  // Determine nested preference: CLI > TOML > Default (false)
  let nested: boolean;

  if (argv.nested !== undefined) {
    // CLI explicitly set nested (either --nested or --no-nested)
    nested = argv.nested;
  } else {
    // CLI didn't set nested, check TOML configuration
    try {
      const config = await loadConfig({
        projectRoot,
        configPath,
      });
      // Use TOML setting if available, otherwise default to false
      nested = config.nested ?? false;
    } catch {
      // If config loading fails, use default (false)
      nested = false;
    }
  }

  // Determine skills preference: CLI > TOML > Default (enabled)
  let skillsEnabled: boolean | undefined;
  if (argv.skills !== undefined) {
    skillsEnabled = argv.skills;
  } else {
    skillsEnabled = undefined; // Let config/default decide
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
      nested,
      backup,
      skillsEnabled,
    );
    console.log('Ruler apply completed successfully.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${ERROR_PREFIX} ${message}`);
    process.exit(1);
  }
}

/**
 * Handler for the 'init' command.
 */
export async function initHandler(argv: InitArgs): Promise<void> {
  const projectRoot = argv['project-root'];
  const isGlobal = argv['global'];

  const rulerDir = isGlobal
    ? path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'ruler',
      )
    : path.join(projectRoot, '.ruler');
  await fs.mkdir(rulerDir, { recursive: true });
  const instructionsPath = path.join(rulerDir, DEFAULT_RULES_FILENAME); // .ruler/AGENTS.md
  const tomlPath = path.join(rulerDir, 'ruler.toml');
  const exists = async (p: string) => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  };
  const DEFAULT_INSTRUCTIONS = `# AGENTS.md\n\nCentralised AI agent instructions. Add coding guidelines, style guides, and project context here.\n\nRuler concatenates all .md files in this directory (and subdirectories), starting with AGENTS.md (if present), then remaining files in sorted order.\n`;
  const DEFAULT_TOML = `# Ruler Configuration File
# See https://ai.intellectronica.net/ruler for documentation.

# To specify which agents are active by default when --agents is not used,
# uncomment and populate the following line. If omitted, all agents are active.
# default_agents = ["copilot", "claude"]

# Enable nested rule loading from nested .ruler directories
# When enabled, ruler will search for and process .ruler directories throughout the project hierarchy
# nested = false

# --- Agent Specific Configurations ---
# You can enable/disable agents and override their default output paths here.
# Use lowercase agent identifiers: amp, copilot, claude, codex, cursor, windsurf, cline, aider, kilocode

# [agents.copilot]
# enabled = true
# output_path = ".github/copilot-instructions.md"

# [agents.aider]
# enabled = true
# output_path_instructions = "AGENTS.md"
# output_path_config = ".aider.conf.yml"

# [agents.gemini-cli]
# enabled = true

# --- MCP Servers ---
# Define Model Context Protocol servers here. Two examples:
# 1. A stdio server (local executable)
# 2. A remote server (HTTP-based)

# [mcp_servers.example_stdio]
# command = "node"
# args = ["scripts/your-mcp-server.js"]
# env = { API_KEY = "replace_me" }

# [mcp_servers.example_remote]
# url = "https://api.example.com/mcp"
# headers = { Authorization = "Bearer REPLACE_ME" }
`;
  if (!(await exists(instructionsPath))) {
    // Create new AGENTS.md regardless of legacy presence.
    await fs.writeFile(instructionsPath, DEFAULT_INSTRUCTIONS);
    console.log(`[ruler] Created ${instructionsPath}`);
  } else {
    console.log(`[ruler] ${DEFAULT_RULES_FILENAME} already exists, skipping`);
  }
  if (!(await exists(tomlPath))) {
    await fs.writeFile(tomlPath, DEFAULT_TOML);
    console.log(`[ruler] Created ${tomlPath}`);
  } else {
    console.log(`[ruler] ruler.toml already exists, skipping`);
  }
}

/**
 * Handler for the 'revert' command.
 */
export async function revertHandler(argv: RevertArgs): Promise<void> {
  const projectRoot = argv['project-root'];
  const agents = argv.agents
    ? argv.agents.split(',').map((a) => a.trim())
    : undefined;
  const configPath = argv.config;
  const keepBackups = argv['keep-backups'];
  const verbose = argv.verbose;
  const dryRun = argv['dry-run'];
  const localOnly = argv['local-only'];

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
}
