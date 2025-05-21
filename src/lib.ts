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
export async function applyAllAgentConfigs(projectRoot: string): Promise<void> {
  const rulerDir = await findRulerDir(projectRoot);
  if (!rulerDir) {
    throw new Error(`.ruler directory not found from ${projectRoot}`);
  }
  await ensureDirExists(path.join(rulerDir, 'generated'));
  const files = await readMarkdownFiles(rulerDir);
  const concatenated = concatenateRules(files);
  for (const agent of agents) {
    console.log(`[ruler] Applying rules for ${agent.getName()}...`);
    await agent.applyRulerConfig(concatenated, projectRoot);
  }
}
