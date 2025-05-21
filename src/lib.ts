import * as path from 'path';
import {
  findRulerDir,
  readMarkdownFiles,
  ensureDirExists,
} from './core/FileSystemUtils';
import { concatenateRules } from './core/RuleProcessor';
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
): Promise<void> {
  const rulerDir = await findRulerDir(projectRoot);
  if (!rulerDir) {
    throw new Error(`.ruler directory not found from ${projectRoot}`);
  }
  await ensureDirExists(path.join(rulerDir, 'generated'));
  const files = await readMarkdownFiles(rulerDir);
  const concatenated = concatenateRules(files);
  let selected = agents;
  if (includedAgents && includedAgents.length > 0) {
    const filters = includedAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) =>
      filters.some((f) => agent.getName().toLowerCase().includes(f)),
    );
  }
  for (const agent of selected) {
    console.log(`[ruler] Applying rules for ${agent.getName()}...`);
    await agent.applyRulerConfig(concatenated, projectRoot);
  }
}
