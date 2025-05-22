import * as path from 'path';
import {
  findRulerDir,
  readMarkdownFiles,
  ensureDirExists,
} from './core/FileSystemUtils';
import { concatenateRules } from './core/RuleProcessor';
import { loadConfig } from './core/ConfigLoader';
import { IAgent } from './agents/IAgent';
import { CopilotAgent } from './agents/CopilotAgent';
import { ClaudeAgent } from './agents/ClaudeAgent';
import { CodexCliAgent } from './agents/CodexCliAgent';
import { CursorAgent } from './agents/CursorAgent';
import { WindsurfAgent } from './agents/WindsurfAgent';
import { ClineAgent } from './agents/ClineAgent';
import { AiderAgent } from './agents/AiderAgent';

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

  const rulerDir = await findRulerDir(projectRoot);
  if (!rulerDir) {
    throw new Error(`.ruler directory not found from ${projectRoot}`);
  }
  await ensureDirExists(path.join(rulerDir, 'generated'));
  const files = await readMarkdownFiles(rulerDir);
  const concatenated = concatenateRules(files);

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

  for (const agent of selected) {
    console.log(`[ruler] Applying rules for ${agent.getName()}...`);
    const agentConfig = config.agentConfigs[agent.getName()];
    await agent.applyRulerConfig(concatenated, projectRoot, agentConfig);
  }
}
