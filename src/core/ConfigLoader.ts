import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseTOML } from '@iarna/toml';
import { z } from 'zod';
import {
  McpConfig,
  GlobalMcpConfig,
  GitignoreConfig,
  BackupConfig,
  SkillsConfig,
  RulesConfig,
} from '../types';
import { createRulerError } from '../constants';

interface ErrnoException extends Error {
  code?: string;
}

const mcpConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    merge_strategy: z.enum(['merge', 'overwrite']).optional(),
  })
  .optional();

const agentConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    output_path: z.string().optional(),
    output_path_instructions: z.string().optional(),
    output_path_config: z.string().optional(),
    mcp: mcpConfigSchema,
  })
  .optional();

const rulerConfigSchema = z.object({
  default_agents: z.array(z.string()).optional(),
  root_folder: z.string().optional(),
  agents: z.record(z.string(), agentConfigSchema).optional(),
  mcp: z
    .object({
      enabled: z.boolean().optional(),
      merge_strategy: z.enum(['merge', 'overwrite']).optional(),
    })
    .optional(),
  gitignore: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  backup: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  skills: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  rules: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
      merge_strategy: z.enum(['all', 'cursor']).optional(),
    })
    .optional(),
  nested: z.boolean().optional(),
});

/**
 * Recursively creates a new object with only enumerable string keys,
 * effectively excluding Symbol properties.
 * The @iarna/toml parser adds Symbol properties (Symbol(type), Symbol(declared))
 * for metadata, which Zod v4+ validates and rejects as invalid record keys.
 * By rebuilding the object structure using Object.keys(), we create clean objects
 * that only contain the actual data without Symbol metadata.
 */
function stripSymbols(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripSymbols);
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = stripSymbols((obj as Record<string, unknown>)[key]);
  }
  return result;
}

/**
 * Configuration for a specific agent as defined in ruler.toml.
 */
export interface IAgentConfig {
  enabled?: boolean;
  outputPath?: string;
  outputPathInstructions?: string;
  outputPathConfig?: string;
  /** MCP propagation config for this agent. */
  mcp?: McpConfig;
}

/**
 * Parsed ruler configuration values.
 */
export interface LoadedConfig {
  /** Agents to run by default, as specified by default_agents. */
  defaultAgents?: string[];
  /** Root folder name (e.g., ".ruler" or ".claude"). */
  rootFolder?: string;
  /** Per-agent configuration overrides. */
  agentConfigs: Record<string, IAgentConfig>;
  /** Command-line agent filters (--agents), if provided. */
  cliAgents?: string[];
  /** Global MCP servers configuration section. */
  mcp?: GlobalMcpConfig;
  /** Gitignore configuration section. */
  gitignore?: GitignoreConfig;
  /** Backup configuration section. */
  backup?: BackupConfig;
  /** Skills configuration section. */
  skills?: SkillsConfig;
  /** Rules configuration section for filtering markdown files. */
  rules?: RulesConfig;
  /** Whether to enable nested rule loading from nested .ruler directories. */
  nested?: boolean;
  /** Whether the nested option was explicitly provided in the config. */
  nestedDefined?: boolean;
}

/**
 * Options for loading the ruler configuration.
 */
export interface ConfigOptions {
  projectRoot: string;
  /** Path to a custom TOML config file. */
  configPath?: string;
  /** CLI filters from --agents option. */
  cliAgents?: string[];
}

/**
 * Loads and parses the ruler TOML configuration file, applying defaults.
 * If the file is missing or invalid, returns empty/default config.
 */
export async function loadConfig(
  options: ConfigOptions,
): Promise<LoadedConfig> {
  const { projectRoot, configPath, cliAgents } = options;
  let configFile: string;

  if (configPath) {
    configFile = path.resolve(configPath);
  } else {
    // Try local .ruler/ruler.toml first
    const localConfigFile = path.join(projectRoot, '.ruler', 'ruler.toml');
    try {
      await fs.access(localConfigFile);
      configFile = localConfigFile;
    } catch {
      // If .ruler config doesn't exist, try .claude/ruler.toml
      const claudeConfigFile = path.join(projectRoot, '.claude', 'ruler.toml');
      try {
        await fs.access(claudeConfigFile);
        configFile = claudeConfigFile;
      } catch {
        // If neither local config exists, try global config
        const xdgConfigDir =
          process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
        configFile = path.join(xdgConfigDir, 'ruler', 'ruler.toml');
      }
    }
  }
  let raw: Record<string, unknown> = {};
  try {
    const text = await fs.readFile(configFile, 'utf8');
    const parsed = text.trim() ? parseTOML(text) : {};
    // Strip Symbol properties added by @iarna/toml (required for Zod v4+)
    raw = stripSymbols(parsed) as Record<string, unknown>;

    // Validate the configuration with zod
    const validationResult = rulerConfigSchema.safeParse(raw);
    if (!validationResult.success) {
      throw createRulerError(
        'Invalid configuration file format',
        `File: ${configFile}, Errors: ${validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      );
    }
  } catch (err) {
    if (err instanceof Error && (err as ErrnoException).code !== 'ENOENT') {
      if (err.message.includes('[ruler]')) {
        throw err; // Re-throw validation errors
      }
      console.warn(
        `[ruler] Warning: could not read config file at ${configFile}: ${err.message}`,
      );
    }
    raw = {};
  }

  const defaultAgents = Array.isArray(raw.default_agents)
    ? raw.default_agents.map((a) => String(a))
    : undefined;

  const rootFolder =
    typeof raw.root_folder === 'string' ? raw.root_folder : undefined;

  const agentsSection =
    raw.agents && typeof raw.agents === 'object' && !Array.isArray(raw.agents)
      ? (raw.agents as Record<string, unknown>)
      : {};
  const agentConfigs: Record<string, IAgentConfig> = {};
  for (const [name, section] of Object.entries(agentsSection)) {
    if (section && typeof section === 'object') {
      const sectionObj = section as Record<string, unknown>;
      const cfg: IAgentConfig = {};
      if (typeof sectionObj.enabled === 'boolean') {
        cfg.enabled = sectionObj.enabled;
      }
      if (typeof sectionObj.output_path === 'string') {
        cfg.outputPath = path.resolve(projectRoot, sectionObj.output_path);
      }
      if (typeof sectionObj.output_path_instructions === 'string') {
        cfg.outputPathInstructions = path.resolve(
          projectRoot,
          sectionObj.output_path_instructions,
        );
      }
      if (typeof sectionObj.output_path_config === 'string') {
        cfg.outputPathConfig = path.resolve(
          projectRoot,
          sectionObj.output_path_config,
        );
      }
      if (sectionObj.mcp && typeof sectionObj.mcp === 'object') {
        const m = sectionObj.mcp as Record<string, unknown>;
        const mcpCfg: McpConfig = {};
        if (typeof m.enabled === 'boolean') {
          mcpCfg.enabled = m.enabled;
        }
        if (typeof m.merge_strategy === 'string') {
          const ms = m.merge_strategy;
          if (ms === 'merge' || ms === 'overwrite') {
            mcpCfg.strategy = ms;
          }
        }
        cfg.mcp = mcpCfg;
      }
      agentConfigs[name] = cfg;
    }
  }

  const rawMcpSection =
    raw.mcp && typeof raw.mcp === 'object' && !Array.isArray(raw.mcp)
      ? (raw.mcp as Record<string, unknown>)
      : {};
  const globalMcpConfig: GlobalMcpConfig = {};
  if (typeof rawMcpSection.enabled === 'boolean') {
    globalMcpConfig.enabled = rawMcpSection.enabled;
  }
  if (typeof rawMcpSection.merge_strategy === 'string') {
    const strat = rawMcpSection.merge_strategy;
    if (strat === 'merge' || strat === 'overwrite') {
      globalMcpConfig.strategy = strat;
    }
  }

  const rawGitignoreSection =
    raw.gitignore &&
    typeof raw.gitignore === 'object' &&
    !Array.isArray(raw.gitignore)
      ? (raw.gitignore as Record<string, unknown>)
      : {};
  const gitignoreConfig: GitignoreConfig = {};
  if (typeof rawGitignoreSection.enabled === 'boolean') {
    gitignoreConfig.enabled = rawGitignoreSection.enabled;
  }

  const rawBackupSection =
    raw.backup && typeof raw.backup === 'object' && !Array.isArray(raw.backup)
      ? (raw.backup as Record<string, unknown>)
      : {};
  const backupConfig: BackupConfig = {};
  if (typeof rawBackupSection.enabled === 'boolean') {
    backupConfig.enabled = rawBackupSection.enabled;
  }

  const rawSkillsSection =
    raw.skills && typeof raw.skills === 'object' && !Array.isArray(raw.skills)
      ? (raw.skills as Record<string, unknown>)
      : {};
  const skillsConfig: SkillsConfig = {};
  if (typeof rawSkillsSection.enabled === 'boolean') {
    skillsConfig.enabled = rawSkillsSection.enabled;
  }
  if (typeof rawSkillsSection.generate_from_rules === 'boolean') {
    skillsConfig.generate_from_rules = rawSkillsSection.generate_from_rules;
  }

  const rawRulesSection =
    raw.rules && typeof raw.rules === 'object' && !Array.isArray(raw.rules)
      ? (raw.rules as Record<string, unknown>)
      : {};
  const rulesConfig: RulesConfig = {};
  if (Array.isArray(rawRulesSection.include)) {
    rulesConfig.include = rawRulesSection.include.map((p) => String(p));
  }
  if (Array.isArray(rawRulesSection.exclude)) {
    rulesConfig.exclude = rawRulesSection.exclude.map((p) => String(p));
  }
  if (
    rawRulesSection.merge_strategy === 'all' ||
    rawRulesSection.merge_strategy === 'cursor'
  ) {
    rulesConfig.merge_strategy = rawRulesSection.merge_strategy;
  }

  const nestedDefined = typeof raw.nested === 'boolean';
  const nested = nestedDefined ? (raw.nested as boolean) : false;

  return {
    defaultAgents,
    rootFolder,
    agentConfigs,
    cliAgents,
    mcp: globalMcpConfig,
    gitignore: gitignoreConfig,
    backup: backupConfig,
    skills: skillsConfig,
    rules: rulesConfig,
    nested,
    nestedDefined,
  };
}
