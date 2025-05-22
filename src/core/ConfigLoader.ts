import { promises as fs } from 'fs';
import * as path from 'path';
import toml from 'toml';

/**
 * Configuration for a specific agent as defined in ruler.toml.
 */
export interface IAgentConfig {
  enabled?: boolean;
  outputPath?: string;
  outputPathInstructions?: string;
  outputPathConfig?: string;
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
  const configFile = configPath
    ? path.resolve(configPath)
    : path.join(projectRoot, '.ruler', 'ruler.toml');
  let raw: any = {};
  try {
    const text = await fs.readFile(configFile, 'utf8');
    raw = text.trim() ? toml.parse(text) : {};
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.warn(
        `[ruler] Warning: could not read config file at ${configFile}: ${err.message}`,
      );
    }
    raw = {};
  }

  const defaultAgents = Array.isArray(raw.default_agents)
    ? raw.default_agents.map((a: any) => String(a))
    : undefined;

  const agentsSection =
    raw.agents && typeof raw.agents === 'object' ? raw.agents : {};
  const agentConfigs: Record<string, IAgentConfig> = {};
  for (const [name, section] of Object.entries(agentsSection)) {
    if (section && typeof section === 'object') {
      const cfg: IAgentConfig = {};
      if (typeof (section as any).enabled === 'boolean') {
        cfg.enabled = (section as any).enabled;
      }
      if (typeof (section as any).output_path === 'string') {
        cfg.outputPath = path.resolve(
          projectRoot,
          (section as any).output_path,
        );
      }
      if (typeof (section as any).output_path_instructions === 'string') {
        cfg.outputPathInstructions = path.resolve(
          projectRoot,
          (section as any).output_path_instructions,
        );
      }
      if (typeof (section as any).output_path_config === 'string') {
        cfg.outputPathConfig = path.resolve(
          projectRoot,
          (section as any).output_path_config,
        );
      }
      agentConfigs[name] = cfg;
    }
  }

  return { defaultAgents, agentConfigs, cliAgents };
}
