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
import { FirebaseAgent } from './agents/FirebaseAgent';
import { OpenHandsAgent } from './agents/OpenHandsAgent';
import { GeminiCliAgent } from './agents/GeminiCliAgent';
import { JulesAgent } from './agents/JulesAgent';
import { JunieAgent } from './agents/JunieAgent';
import { AugmentCodeAgent } from './agents/AugmentCodeAgent';
import { KiloCodeAgent } from './agents/KiloCodeAgent';
import { OpenCodeAgent } from './agents/OpenCodeAgent';
import { CrushAgent } from './agents/CrushAgent';
import { GooseAgent } from './agents/GooseAgent';
import { AmpAgent } from './agents/AmpAgent';
import { mergeMcp } from './mcp/merge';
import { validateMcp } from './mcp/validate';
import { getNativeMcpPath, readNativeMcp, writeNativeMcp } from './paths/mcp';
import { McpStrategy } from './types';
import { propagateMcpToOpenHands } from './mcp/propagateOpenHandsMcp';
import { propagateMcpToOpenCode } from './mcp/propagateOpenCodeMcp';
import { getAgentOutputPaths } from './agents/agent-utils';
import { createRulerError, logVerbose } from './constants';

const agents: IAgent[] = [
  new CopilotAgent(),
  new ClaudeAgent(),
  new CodexCliAgent(),
  new CursorAgent(),
  new WindsurfAgent(),
  new ClineAgent(),
  new AiderAgent(),
  new FirebaseAgent(),
  new OpenHandsAgent(),
  new GeminiCliAgent(),
  new JulesAgent(),
  new JunieAgent(),
  new AugmentCodeAgent(),
  new KiloCodeAgent(),
  new OpenCodeAgent(),
  new GooseAgent(),
  new CrushAgent(),
  new AmpAgent(),
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
  localOnly = false,
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

  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot, !localOnly);
  if (!rulerDir) {
    throw createRulerError(
      `.ruler directory not found`,
      `Searched from: ${projectRoot}`,
    );
  }
  logVerbose(`Found .ruler directory at: ${rulerDir}`, verbose);

  const files = await FileSystemUtils.readMarkdownFiles(rulerDir);
  logVerbose(
    `Found ${files.length} markdown files in ruler configuration directory`,
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

    // Check if any of the specified agents don't exist
    const validAgentIdentifiers = new Set(
      agents.map((agent) => agent.getIdentifier()),
    );
    const validAgentNames = new Set(
      agents.map((agent) => agent.getName().toLowerCase()),
    );

    const invalidAgents = filters.filter(
      (filter) =>
        !validAgentIdentifiers.has(filter) &&
        ![...validAgentNames].some((name) => name.includes(filter)),
    );

    if (invalidAgents.length > 0) {
      throw createRulerError(
        `Invalid agent specified: ${invalidAgents.join(', ')}`,
        `Valid agents are: ${[...validAgentIdentifiers].join(', ')}`,
      );
    }

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

    // Check if any of the default agents don't exist
    const validAgentIdentifiers = new Set(
      agents.map((agent) => agent.getIdentifier()),
    );
    const validAgentNames = new Set(
      agents.map((agent) => agent.getName().toLowerCase()),
    );

    const invalidAgents = defaults.filter(
      (filter) =>
        !validAgentIdentifiers.has(filter) &&
        ![...validAgentNames].some((name) => name.includes(filter)),
    );

    if (invalidAgents.length > 0) {
      throw createRulerError(
        `Invalid agent specified in default_agents: ${invalidAgents.join(', ')}`,
        `Valid agents are: ${[...validAgentIdentifiers].join(', ')}`,
      );
    }

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

    // Also add the backup file paths to the gitignore list
    const backupPaths = outputPaths.map((p) => `${p}.bak`);
    generatedPaths.push(...backupPaths);

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
      let finalAgentConfig = agentConfig;
      if (agent.getIdentifier() === 'augmentcode' && rulerMcpJson) {
        const resolvedStrategy =
          cliMcpStrategy ??
          agentConfig?.mcp?.strategy ??
          config.mcp?.strategy ??
          'merge';

        finalAgentConfig = {
          ...agentConfig,
          mcp: {
            ...agentConfig?.mcp,
            strategy: resolvedStrategy,
          },
        };
      }

      await agent.applyRulerConfig(
        concatenated,
        projectRoot,
        rulerMcpJson,
        finalAgentConfig,
      );
    }

    const dest = await getNativeMcpPath(agent.getName(), projectRoot);
    const mcpEnabledForAgent =
      cliMcpEnabled &&
      (agentConfig?.mcp?.enabled ?? config.mcp?.enabled ?? true);
    const rulerMcpFile = path.join(rulerDir, 'mcp.json');

    if (dest && mcpEnabledForAgent) {
      // Include MCP config file in .gitignore only if it's within the project directory
      if (dest.startsWith(projectRoot)) {
        const relativeDest = path.relative(projectRoot, dest);
        generatedPaths.push(relativeDest);
        // Also add the backup for the MCP file
        generatedPaths.push(`${relativeDest}.bak`);
      }

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
        // Open Hands config file is already included above
      } else if (agent.getIdentifier() === 'augmentcode') {
        // *** Special handling for AugmentCode ***
        // AugmentCode handles MCP configuration internally in applyRulerConfig
        // by updating VSCode settings.json with augment.advanced.mcpServers format
        if (dryRun) {
          logVerbose(
            `DRY RUN: AugmentCode MCP config handled internally via VSCode settings`,
            verbose,
          );
        }
      } else if (agent.getIdentifier() === 'opencode') {
        // *** Special handling for OpenCode ***
        if (dryRun) {
          logVerbose(
            `DRY RUN: Would apply MCP config by updating OpenCode config file: ${dest}`,
            verbose,
          );
        } else {
          await propagateMcpToOpenCode(rulerMcpFile, dest);
        }
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
    const uniquePaths = [...new Set(generatedPaths)];

    // Add wildcard pattern for backup files
    uniquePaths.push('*.bak');

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
