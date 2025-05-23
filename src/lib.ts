import * as path from 'path';
import { promises as fs } from 'fs';
import * as FileSystemUtils from './core/FileSystemUtils';
import { concatenateRules } from './core/RuleProcessor';
import { loadConfig } from './core/ConfigLoader';
import { updateGitignore } from './core/GitignoreUtils';
import { IAgent } from './agents/IAgent';
import { CopilotAgent } from './agents/CopilotAgent';
import { ClaudeAgent } from './agents/ClaudeAgent';
import { CodexCliAgent } from './agents/CodexCliAgent';
import { CursorAgent } from './agents/CursorAgent';
import { WindsurfAgent } from './agents/WindsurfAgent';
import { ClineAgent } from './agents/ClineAgent';
import { AiderAgent } from './agents/AiderAgent';
import { mergeMcp } from './mcp/merge';
import { validateMcp } from './mcp/validate';
import { getNativeMcpPath, readNativeMcp, writeNativeMcp } from './paths/mcp';
import { McpStrategy } from './types';
import { IAgentConfig } from './agents/IAgent';

/**
 * Gets all output paths for an agent, taking into account any config overrides.
 */
function getAgentOutputPaths(
  agent: IAgent,
  projectRoot: string,
  agentConfig?: IAgentConfig,
): string[] {
  const paths: string[] = [];
  const defaults = agent.getDefaultOutputPath(projectRoot);

  if (typeof defaults === 'string') {
    // Single output path (most agents)
    const actualPath = agentConfig?.outputPath ?? defaults;
    paths.push(actualPath);
  } else {
    // Multiple output paths (e.g., AiderAgent)
    const defaultPaths = defaults as Record<string, string>;

    // Handle instructions path
    if ('instructions' in defaultPaths) {
      const instructionsPath =
        agentConfig?.outputPathInstructions ?? defaultPaths.instructions;
      paths.push(instructionsPath);
    }

    // Handle config path
    if ('config' in defaultPaths) {
      const configPath = agentConfig?.outputPathConfig ?? defaultPaths.config;
      paths.push(configPath);
    }

    // Handle any other paths in the default paths record
    for (const [key, defaultPath] of Object.entries(defaultPaths)) {
      if (key !== 'instructions' && key !== 'config') {
        // For unknown path types, use the default since we don't have specific config overrides
        paths.push(defaultPath);
      }
    }
  }

  return paths;
}

const agents: IAgent[] = [
  new CopilotAgent(),
  new ClaudeAgent(),
  new CodexCliAgent(),
  new CursorAgent(),
  new WindsurfAgent(),
  new ClineAgent(),
  new AiderAgent(),
];

/**
 * Applies ruler configurations for all supported AI agents.
 * @param projectRoot Root directory of the project
 */
/**
 * Applies ruler configurations for selected AI agents.
 * @param projectRoot Root directory of the project
 * @param includedAgents Optional list of agent name filters (case-insensitive substrings)
 */
export async function applyAllAgentConfigs(
  projectRoot: string,
  includedAgents?: string[],
  configPath?: string,
  cliMcpEnabled = true,
  cliMcpStrategy?: McpStrategy,
  cliGitignoreEnabled?: boolean,
): Promise<void> {
  // Load configuration (default_agents, per-agent overrides, CLI filters)
  const config = await loadConfig({
    projectRoot,
    cliAgents: includedAgents,
    configPath,
  });
  // Normalize per-agent config keys to actual agent names (substring match)
  const rawConfigs = config.agentConfigs;
  const mappedConfigs: Record<string, (typeof rawConfigs)[string]> = {};
  for (const [key, cfg] of Object.entries(rawConfigs)) {
    const lowerKey = key.toLowerCase();
    for (const agent of agents) {
      if (agent.getName().toLowerCase().includes(lowerKey)) {
        mappedConfigs[agent.getName()] = cfg;
      }
    }
  }
  config.agentConfigs = mappedConfigs;

  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot);
  if (!rulerDir) {
    throw new Error(`.ruler directory not found from ${projectRoot}`);
  }
  await FileSystemUtils.ensureDirExists(path.join(rulerDir, 'generated'));
  const files = await FileSystemUtils.readMarkdownFiles(rulerDir);
  const concatenated = concatenateRules(files);

  const mcpFile = path.join(rulerDir, 'mcp.json');
  let rulerMcpJson: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(mcpFile, 'utf8');
    rulerMcpJson = JSON.parse(raw) as Record<string, unknown>;
    validateMcp(rulerMcpJson);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  // Determine which agents to run:
  // CLI --agents > config.default_agents > per-agent.enabled flags > default all
  let selected = agents;
  if (config.cliAgents && config.cliAgents.length > 0) {
    const filters = config.cliAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) =>
      filters.some((f) => agent.getName().toLowerCase().includes(f)),
    );
  } else if (config.defaultAgents && config.defaultAgents.length > 0) {
    const defaults = config.defaultAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) => {
      const key = agent.getName();
      const override = config.agentConfigs[key]?.enabled;
      if (override !== undefined) {
        return override;
      }
      return defaults.includes(key.toLowerCase());
    });
  } else {
    selected = agents.filter(
      (agent) => config.agentConfigs[agent.getName()]?.enabled !== false,
    );
  }

  // Collect all generated file paths for .gitignore
  const generatedPaths: string[] = [];

  for (const agent of selected) {
    console.log(`[ruler] Applying rules for ${agent.getName()}...`);
    const agentConfig = config.agentConfigs[agent.getName()];
    await agent.applyRulerConfig(concatenated, projectRoot, agentConfig);

    // Collect output paths for .gitignore
    const outputPaths = getAgentOutputPaths(agent, projectRoot, agentConfig);
    generatedPaths.push(...outputPaths);

    const dest = await getNativeMcpPath(agent.getName(), projectRoot);
    const enabled =
      cliMcpEnabled &&
      (agentConfig?.mcp?.enabled ?? config.mcp?.enabled ?? true);
    if (dest && rulerMcpJson != null && enabled) {
      const strategy =
        cliMcpStrategy ??
        agentConfig?.mcp?.strategy ??
        config.mcp?.strategy ??
        'merge';
      const existing = await readNativeMcp(dest);
      const merged = mergeMcp(existing, rulerMcpJson, strategy);
      await writeNativeMcp(dest, merged);
    }
  }

  // Handle .gitignore updates
  // Configuration precedence: CLI > TOML > Default (enabled)
  let gitignoreEnabled: boolean;
  if (cliGitignoreEnabled !== undefined) {
    gitignoreEnabled = cliGitignoreEnabled;
  } else if (config.gitignore?.enabled !== undefined) {
    gitignoreEnabled = config.gitignore.enabled;
  } else {
    gitignoreEnabled = true; // Default enabled
  }

  if (gitignoreEnabled && generatedPaths.length > 0) {
    // Filter out .bak files as specified in requirements
    const pathsToIgnore = generatedPaths.filter((p) => !p.endsWith('.bak'));
    const uniquePaths = [...new Set(pathsToIgnore)];

    if (uniquePaths.length > 0) {
      await updateGitignore(projectRoot, uniquePaths);
      console.log(
        `[ruler] Updated .gitignore with ${uniquePaths.length} unique path(s) in the Ruler block.`,
      );
    }
  }
}
