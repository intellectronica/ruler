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
import * as ClineAgent from './agents/ClineAgent';
import { AiderAgent } from './agents/AiderAgent';
import { FirebaseAgent } from './agents/FirebaseAgent';
import { OpenHandsAgent } from './agents/OpenHandsAgent';
import { GeminiCliAgent } from './agents/GeminiCliAgent';
import { OpenCodeAgent } from './agents/OpenCodeAgent';
import { JulesAgent } from './agents/JulesAgent';
import { mergeMcp } from './mcp/merge';
import { validateMcp } from './mcp/validate';
import { getNativeMcpPath, readNativeMcp, writeNativeMcp } from './paths/mcp';
import { McpStrategy } from './types';
import { propagateMcpToOpenHands } from './mcp/propagateOpenHandsMcp';
import { IAgentConfig } from './agents/IAgent';
import { createRulerError, logVerbose } from './constants';

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
  new ClineAgent.ClineAgent(),
  new AiderAgent(),
  new FirebaseAgent(),
  new OpenHandsAgent(),
  new GeminiCliAgent(),
  new OpenCodeAgent(),
  new JulesAgent(),
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
  verbose = false,
  dryRun = false,
): Promise<void> {
  // Load configuration (default_agents, per-agent overrides, CLI filters)
  logVerbose(
    `Loading configuration from project root: ${projectRoot}`,
    verbose,
  );
  if (configPath) {
    logVerbose(`Using custom config path: ${configPath}`, verbose);
  }
  const config = await loadConfig({
    projectRoot,
    cliAgents: includedAgents,
    configPath,
  });
  logVerbose(
    `Loaded configuration with ${Object.keys(config.agentConfigs).length} agent configs`,
    verbose,
  );
  // Normalize per-agent config keys to agent identifiers (exact match or substring match)
  const rawConfigs = config.agentConfigs;
  const mappedConfigs: Record<string, (typeof rawConfigs)[string]> = {};
  for (const [key, cfg] of Object.entries(rawConfigs)) {
    const lowerKey = key.toLowerCase();
    for (const agent of agents) {
      const identifier = agent.getIdentifier();
      // Exact match with identifier or substring match with display name for backwards compatibility
      if (
        identifier === lowerKey ||
        agent.getName().toLowerCase().includes(lowerKey)
      ) {
        mappedConfigs[identifier] = cfg;
      }
    }
  }
  config.agentConfigs = mappedConfigs;

  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot);
  if (!rulerDir) {
    throw createRulerError(
      `.ruler directory not found`,
      `Searched from: ${projectRoot}`,
    );
  }
  logVerbose(`Found .ruler directory at: ${rulerDir}`, verbose);

  const files = await FileSystemUtils.readMarkdownFiles(rulerDir);
  logVerbose(
    `Found ${files.length} markdown files in .ruler directory`,
    verbose,
  );
  const concatenated = concatenateRules(files);
  logVerbose(
    `Concatenated rules length: ${concatenated.length} characters`,
    verbose,
  );

  const mcpFile = path.join(rulerDir, 'mcp.json');
  let rulerMcpJson: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(mcpFile, 'utf8');
    rulerMcpJson = JSON.parse(raw) as Record<string, unknown>;
    validateMcp(rulerMcpJson);
    logVerbose(`Loaded MCP configuration from: ${mcpFile}`, verbose);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw createRulerError(
        `Failed to load MCP configuration`,
        `File: ${mcpFile}, Error: ${(err as Error).message}`,
      );
    }
    logVerbose(`No MCP configuration found at: ${mcpFile}`, verbose);
  }

  // Determine which agents to run:
  // CLI --agents > config.default_agents > per-agent.enabled flags > default all
  let selected = agents;
  if (config.cliAgents && config.cliAgents.length > 0) {
    const filters = config.cliAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) =>
      filters.some(
        (f) =>
          agent.getIdentifier() === f ||
          agent.getName().toLowerCase().includes(f),
      ),
    );
    logVerbose(
      `Selected agents via CLI filter: ${selected.map((a) => a.getName()).join(', ')}`,
      verbose,
    );
  } else if (config.defaultAgents && config.defaultAgents.length > 0) {
    const defaults = config.defaultAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) => {
      const identifier = agent.getIdentifier();
      const override = config.agentConfigs[identifier]?.enabled;
      if (override !== undefined) {
        return override;
      }
      return defaults.some(
        (d) => identifier === d || agent.getName().toLowerCase().includes(d),
      );
    });
    logVerbose(
      `Selected agents via config default_agents: ${selected.map((a) => a.getName()).join(', ')}`,
      verbose,
    );
  } else {
    selected = agents.filter(
      (agent) => config.agentConfigs[agent.getIdentifier()]?.enabled !== false,
    );
    logVerbose(
      `Selected all enabled agents: ${selected.map((a) => a.getName()).join(', ')}`,
      verbose,
    );
  }

  // Collect all generated file paths for .gitignore
  const generatedPaths: string[] = [];
  let agentsMdWritten = false;

  for (const agent of selected) {
    const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';
    console.log(`${actionPrefix} Applying rules for ${agent.getName()}...`);
    logVerbose(`Processing agent: ${agent.getName()}`, verbose);
    const agentConfig = config.agentConfigs[agent.getIdentifier()];

    // Collect output paths for .gitignore
    const outputPaths = getAgentOutputPaths(agent, projectRoot, agentConfig);
    logVerbose(
      `Agent ${agent.getName()} output paths: ${outputPaths.join(', ')}`,
      verbose,
    );
    generatedPaths.push(...outputPaths);

    if (dryRun) {
      logVerbose(
        `DRY RUN: Would write rules to: ${outputPaths.join(', ')}`,
        verbose,
      );
    } else {
      if (
        agent.getIdentifier() === 'jules' ||
        agent.getIdentifier() === 'codex'
      ) {
        if (agentsMdWritten) {
          continue;
        }
        agentsMdWritten = true;
      }
      await agent.applyRulerConfig(
        concatenated,
        projectRoot,
        rulerMcpJson,
        agentConfig,
      );
    }

    const dest = await getNativeMcpPath(agent.getName(), projectRoot);
    const mcpEnabledForAgent =
      cliMcpEnabled &&
      (agentConfig?.mcp?.enabled ?? config.mcp?.enabled ?? true);
    const rulerMcpFile = path.join(rulerDir, 'mcp.json');

    if (dest && mcpEnabledForAgent) {
      if (agent.getIdentifier() === 'openhands') {
        // *** Special handling for Open Hands ***
        if (dryRun) {
          logVerbose(
            `DRY RUN: Would apply MCP config by updating TOML file: ${dest}`,
            verbose,
          );
        } else {
          await propagateMcpToOpenHands(rulerMcpFile, dest);
        }
        // Include Open Hands config file in .gitignore
        generatedPaths.push(dest);
      } else {
        if (rulerMcpJson) {
          const strategy =
            cliMcpStrategy ??
            agentConfig?.mcp?.strategy ??
            config.mcp?.strategy ??
            'merge';

          // Determine the correct server key for the agent
          const serverKey = agent.getMcpServerKey?.() ?? 'mcpServers';

          logVerbose(
            `Applying MCP config for ${agent.getName()} with strategy: ${strategy} and key: ${serverKey}`,
            verbose,
          );

          if (dryRun) {
            logVerbose(`DRY RUN: Would apply MCP config to: ${dest}`, true);
          } else {
            const existing = await readNativeMcp(dest);
            const merged = mergeMcp(
              existing,
              rulerMcpJson,
              strategy,
              serverKey,
            );
            await writeNativeMcp(dest, merged);
          }
        }
      }
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
      const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';
      if (dryRun) {
        console.log(
          `${actionPrefix} Would update .gitignore with ${uniquePaths.length} unique path(s): ${uniquePaths.join(', ')}`,
        );
      } else {
        await updateGitignore(projectRoot, uniquePaths);
        console.log(
          `${actionPrefix} Updated .gitignore with ${uniquePaths.length} unique path(s) in the Ruler block.`,
        );
      }
    }
  }
}
