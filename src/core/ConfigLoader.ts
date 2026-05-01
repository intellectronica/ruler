import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseTOML } from '@iarna/toml';
import { z } from 'zod';
import {
  McpConfig,
  GlobalMcpConfig,
  GitignoreConfig,
  SkillsConfig,
  SubagentsConfig,
} from '../types';
import { createRulerError, logWarn } from '../constants';

// One-shot guard so the deprecation message fires once per process even when
// `loadConfig` is called multiple times (e.g. nested mode walks every
// `.ruler` directory).
let _legacySubagentsWarned = false;

function warnLegacySubagentsSection(): void {
  if (_legacySubagentsWarned) return;
  _legacySubagentsWarned = true;
  logWarn(
    '`[subagents]` is deprecated; rename it to `[agents]` in your ruler.toml. ' +
      'The legacy section is honored for now and will be removed in a future release.',
  );
}

/** Test helper — re-arms the deprecation guard so suites can assert it fires. */
export function _resetLegacySubagentsWarningForTests(): void {
  _legacySubagentsWarned = false;
}

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

// `[agents]` is a heterogeneous table that holds two unrelated kinds of keys:
//   - reserved subagent-control booleans (`enabled`, `include_in_rules`)
//   - one nested table per coding-agent integration (`[agents.claude]`, etc.)
// Reserved keys are validated by the object shape; everything else falls
// through `catchall` and is treated as a per-agent config record.
const SUBAGENT_RESERVED_KEYS = new Set(['enabled', 'include_in_rules']);

const rulerConfigSchema = z.object({
  default_agents: z.array(z.string()).optional(),
  agents: z
    .object({
      enabled: z.boolean().optional(),
      include_in_rules: z.boolean().optional(),
    })
    .catchall(agentConfigSchema)
    .optional(),
  mcp: z
    .object({
      enabled: z.boolean().optional(),
      merge_strategy: z.enum(['merge', 'overwrite']).optional(),
    })
    .optional(),
  gitignore: z
    .object({
      enabled: z.boolean().optional(),
      local: z.boolean().optional(),
    })
    .optional(),
  skills: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  // Deprecated: kept in the schema only so that legacy `[subagents]` blocks
  // are preserved through validation. The parser reads from here as a
  // fallback when the new `[agents]` keys are absent and emits a one-time
  // deprecation warning. Remove in the next minor release.
  subagents: z
    .object({
      enabled: z.boolean().optional(),
      include_in_rules: z.boolean().optional(),
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
  /** Per-agent configuration overrides. */
  agentConfigs: Record<string, IAgentConfig>;
  /** Command-line agent filters (--agents), if provided. */
  cliAgents?: string[];
  /** Global MCP servers configuration section. */
  mcp?: GlobalMcpConfig;
  /** Gitignore configuration section. */
  gitignore?: GitignoreConfig;
  /** Skills configuration section. */
  skills?: SkillsConfig;
  /** Subagents configuration section. */
  subagents?: SubagentsConfig;
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
      // If local config doesn't exist, try global config
      const xdgConfigDir =
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      configFile = path.join(xdgConfigDir, 'ruler', 'ruler.toml');
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

  const agentsSection =
    raw.agents && typeof raw.agents === 'object' && !Array.isArray(raw.agents)
      ? (raw.agents as Record<string, unknown>)
      : {};
  const agentConfigs: Record<string, IAgentConfig> = {};
  for (const [name, section] of Object.entries(agentsSection)) {
    // Reserved subagent-control keys live alongside per-agent records in
    // the same `[agents]` table; skip them here so we only process actual
    // coding-agent integrations as agent configs.
    if (SUBAGENT_RESERVED_KEYS.has(name)) continue;
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
  if (typeof rawGitignoreSection.local === 'boolean') {
    gitignoreConfig.local = rawGitignoreSection.local;
  }

  const rawSkillsSection =
    raw.skills && typeof raw.skills === 'object' && !Array.isArray(raw.skills)
      ? (raw.skills as Record<string, unknown>)
      : {};
  const skillsConfig: SkillsConfig = {};
  if (typeof rawSkillsSection.enabled === 'boolean') {
    skillsConfig.enabled = rawSkillsSection.enabled;
  }

  // Subagent control lives under `[agents]` (alongside per-agent records).
  // The reserved keys `enabled` and `include_in_rules` are pulled out here
  // and surfaced internally as `LoadedConfig.subagents` for the rest of the
  // codebase, which still uses the `Subagent*` naming.
  //
  // Backward-compatibility: the previous release used `[subagents]` for the
  // same two keys. We still read those as a fallback when the matching
  // `[agents]` key is absent, and emit a one-time deprecation warning so
  // existing configs keep working while users migrate.
  const rawLegacySubagentsSection =
    raw.subagents &&
    typeof raw.subagents === 'object' &&
    !Array.isArray(raw.subagents)
      ? (raw.subagents as Record<string, unknown>)
      : {};
  const legacyHasContent =
    typeof rawLegacySubagentsSection.enabled === 'boolean' ||
    typeof rawLegacySubagentsSection.include_in_rules === 'boolean';
  if (legacyHasContent) {
    warnLegacySubagentsSection();
  }

  const subagentsConfig: SubagentsConfig = {};
  if (typeof agentsSection.enabled === 'boolean') {
    subagentsConfig.enabled = agentsSection.enabled;
  } else if (typeof rawLegacySubagentsSection.enabled === 'boolean') {
    subagentsConfig.enabled = rawLegacySubagentsSection.enabled;
  }
  if (typeof agentsSection.include_in_rules === 'boolean') {
    subagentsConfig.include_in_rules =
      agentsSection.include_in_rules as boolean;
  } else if (typeof rawLegacySubagentsSection.include_in_rules === 'boolean') {
    subagentsConfig.include_in_rules =
      rawLegacySubagentsSection.include_in_rules;
  }

  const nestedDefined = typeof raw.nested === 'boolean';
  const nested = nestedDefined ? (raw.nested as boolean) : false;

  return {
    defaultAgents,
    agentConfigs,
    cliAgents,
    mcp: globalMcpConfig,
    gitignore: gitignoreConfig,
    skills: skillsConfig,
    subagents: subagentsConfig,
    nested,
    nestedDefined,
  };
}
