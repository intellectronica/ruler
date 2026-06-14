import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseTOML } from '@iarna/toml';
import { z } from 'zod';
import { isPathInsideOrEqual } from './path-utils';
import {
  McpConfig,
  GlobalMcpConfig,
  GitignoreConfig,
  BackupConfig,
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
const SUBAGENT_RESERVED_KEYS = new Set([
  'enabled',
  'include_in_rules',
  'cleanup_orphaned',
]);

const rulerConfigSchema = z.object({
  default_agents: z.array(z.string()).optional(),
  agents: z
    .object({
      enabled: z.boolean().optional(),
      include_in_rules: z.boolean().optional(),
      cleanup_orphaned: z.boolean().optional(),
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
  // Deprecated: kept in the schema only so that legacy `[subagents]` blocks
  // are preserved through validation. The parser reads from here as a
  // fallback when the new `[agents]` keys are absent and emits a one-time
  // deprecation warning. Remove in the next minor release.
  subagents: z
    .object({
      enabled: z.boolean().optional(),
      include_in_rules: z.boolean().optional(),
      cleanup_orphaned: z.boolean().optional(),
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
  /** Agent-scoped MCP server definitions. */
  mcpServers?: Record<string, Record<string, unknown>>;
}

function parseAgentMcpServers(
  sectionObj: Record<string, unknown>,
): Record<string, Record<string, unknown>> | undefined {
  if (
    !sectionObj.mcp_servers ||
    typeof sectionObj.mcp_servers !== 'object' ||
    Array.isArray(sectionObj.mcp_servers)
  ) {
    return undefined;
  }

  const servers: Record<string, Record<string, unknown>> = {};
  for (const [name, def] of Object.entries(
    sectionObj.mcp_servers as Record<string, unknown>,
  )) {
    if (def && typeof def === 'object' && !Array.isArray(def)) {
      servers[name] = normalizeAgentMcpServer(def as Record<string, unknown>);
    }
  }

  return Object.keys(servers).length > 0 ? servers : undefined;
}

function normalizeAgentMcpServer(
  def: Record<string, unknown>,
): Record<string, unknown> {
  const server = { ...def };
  const hasCommand = typeof server.command === 'string';
  const hasUrl = typeof server.url === 'string';

  if (hasCommand && hasUrl) {
    delete server.command;
    delete server.args;
    delete server.env;
    server.type = 'remote';
  }

  return server;
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
  /** Backup configuration section. */
  backup?: BackupConfig;
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
  /** Whether implicit config discovery may fall back to XDG_CONFIG_HOME/ruler. */
  checkGlobal?: boolean;
}

/**
 * Loads and parses the ruler TOML configuration file, applying defaults.
 * Missing implicit configs return defaults. Explicit configs and existing
 * implicit configs fail fast when missing, unreadable, or invalid.
 */
export async function loadConfig(
  options: ConfigOptions,
): Promise<LoadedConfig> {
  const { projectRoot, configPath, cliAgents } = options;
  const checkGlobal = options.checkGlobal ?? true;
  const configFile = configPath
    ? path.resolve(configPath)
    : await resolveImplicitConfigFile(projectRoot, checkGlobal);

  const raw = configFile ? await readConfigFile(configFile) : {};

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
        cfg.outputPath = resolveProjectOutputPath(
          projectRoot,
          sectionObj.output_path,
          configFile,
          `[agents.${name}].output_path`,
        );
      }
      if (typeof sectionObj.output_path_instructions === 'string') {
        cfg.outputPathInstructions = resolveProjectOutputPath(
          projectRoot,
          sectionObj.output_path_instructions,
          configFile,
          `[agents.${name}].output_path_instructions`,
        );
      }
      if (typeof sectionObj.output_path_config === 'string') {
        cfg.outputPathConfig = resolveProjectOutputPath(
          projectRoot,
          sectionObj.output_path_config,
          configFile,
          `[agents.${name}].output_path_config`,
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
      cfg.mcpServers = parseAgentMcpServers(sectionObj);
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
    typeof rawLegacySubagentsSection.include_in_rules === 'boolean' ||
    typeof rawLegacySubagentsSection.cleanup_orphaned === 'boolean';
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
  if (typeof agentsSection.cleanup_orphaned === 'boolean') {
    subagentsConfig.cleanup_orphaned =
      agentsSection.cleanup_orphaned as boolean;
  } else if (typeof rawLegacySubagentsSection.cleanup_orphaned === 'boolean') {
    subagentsConfig.cleanup_orphaned =
      rawLegacySubagentsSection.cleanup_orphaned;
  }

  const nestedDefined = typeof raw.nested === 'boolean';
  const nested = nestedDefined ? (raw.nested as boolean) : false;

  return {
    defaultAgents,
    agentConfigs,
    cliAgents,
    mcp: globalMcpConfig,
    gitignore: gitignoreConfig,
    backup: backupConfig,
    skills: skillsConfig,
    subagents: subagentsConfig,
    nested,
    nestedDefined,
  };
}

function resolveProjectOutputPath(
  projectRoot: string,
  configuredPath: string,
  configFile: string | undefined,
  fieldName: string,
): string {
  const resolvedPath = path.resolve(projectRoot, configuredPath);

  if (!isPathInsideOrEqual(projectRoot, resolvedPath)) {
    throw createRulerError(
      'Configured output path is outside the project root',
      [
        configFile ? `File: ${configFile}` : undefined,
        `Field: ${fieldName}`,
        `Path: ${configuredPath}`,
        `Project root: ${projectRoot}`,
      ]
        .filter(Boolean)
        .join(', '),
    );
  }

  return resolvedPath;
}

async function resolveImplicitConfigFile(
  projectRoot: string,
  checkGlobal: boolean,
): Promise<string | undefined> {
  const localRulerDir = await findNearestLocalRulerDir(projectRoot);
  const localConfigFile = localRulerDir
    ? path.join(localRulerDir, 'ruler.toml')
    : path.join(projectRoot, '.ruler', 'ruler.toml');
  if (await configFileExists(localConfigFile)) {
    return localConfigFile;
  }

  if (!checkGlobal) {
    return undefined;
  }

  const xdgConfigDir =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const globalConfigFile = path.join(xdgConfigDir, 'ruler', 'ruler.toml');
  if (await configFileExists(globalConfigFile)) {
    return globalConfigFile;
  }

  return undefined;
}

async function findNearestLocalRulerDir(
  startPath: string,
): Promise<string | undefined> {
  let current = path.resolve(startPath);

  while (current) {
    const candidate = path.join(current, '.ruler');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // Keep walking; missing or inaccessible candidates simply do not match.
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }

  return undefined;
}

async function configFileExists(configFile: string): Promise<boolean> {
  try {
    await fs.access(configFile);
    return true;
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw createRulerError(
      'Could not access configuration file',
      `File: ${configFile}, Error: ${errorMessage(err)}`,
    );
  }
}

async function readConfigFile(
  configFile: string,
): Promise<Record<string, unknown>> {
  const text = await readConfigText(configFile);
  const parsed = parseConfigText(text, configFile);
  const raw = stripSymbols(parsed) as Record<string, unknown>;
  validateConfig(raw, configFile);
  return raw;
}

async function readConfigText(configFile: string): Promise<string> {
  try {
    return await fs.readFile(configFile, 'utf8');
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      throw createRulerError(
        'Configuration file not found',
        `File: ${configFile}`,
      );
    }
    throw createRulerError(
      'Could not read configuration file',
      `File: ${configFile}, Error: ${errorMessage(err)}`,
    );
  }
}

function parseConfigText(
  text: string,
  configFile: string,
): Record<string, unknown> {
  try {
    return text.trim() ? (parseTOML(text) as Record<string, unknown>) : {};
  } catch (err) {
    throw createRulerError(
      'Invalid configuration file',
      `File: ${configFile}, Error: ${errorMessage(err)}`,
    );
  }
}

function validateConfig(
  raw: Record<string, unknown>,
  configFile: string,
): void {
  const validationResult = rulerConfigSchema.safeParse(raw);
  if (!validationResult.success) {
    throw createRulerError(
      'Invalid configuration file format',
      `File: ${configFile}, Errors: ${validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
