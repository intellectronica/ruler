import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseTOML } from '@iarna/toml';
import { z } from 'zod';
import { McpConfig, GlobalMcpConfig, GitignoreConfig } from '../types';
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
  nested: z.boolean().optional(),
});

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
  /** Per-agent configuration overrides. */
  agentConfigs: Record<string, IAgentConfig>;
  /** Command-line agent filters (--agents), if provided. */
  cliAgents?: string[];
  /** Global MCP servers configuration section. */
  mcp?: GlobalMcpConfig;
  /** Gitignore configuration section. */
  gitignore?: GitignoreConfig;
  /** Whether to enable nested rule loading from nested .ruler directories. */
  nested?: boolean;
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
      // If local config doesn't exist, try global config
      const xdgConfigDir =
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      configFile = path.join(xdgConfigDir, 'ruler', 'ruler.toml');
    }
  }
  let raw: Record<string, unknown> = {};
  try {
    const text = await fs.readFile(configFile, 'utf8');
    raw = text.trim() ? parseTOML(text) : {};

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
      // Handle Cursor-specific configuration
      if (name === 'cursor') {
        if (typeof sectionObj.always_apply === 'boolean') {
          (cfg as any).alwaysApply = sectionObj.always_apply;
        }
        if (typeof sectionObj.description === 'string') {
          (cfg as any).description = sectionObj.description;
        }
        if (Array.isArray(sectionObj.globs)) {
          (cfg as any).globs = sectionObj.globs.filter(g => typeof g === 'string');
        }
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

  const nested = typeof raw.nested === 'boolean' ? raw.nested : false;

  return {
    defaultAgents,
    agentConfigs,
    cliAgents,
    mcp: globalMcpConfig,
    gitignore: gitignoreConfig,
    nested,
  };
}
