import * as path from 'path';
import * as fs from 'fs/promises';
import { IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import { copySkillsDirectory } from '../core/SkillsUtils';

/**
 * Cursor agent adapter.
 * Leverages the standardized AGENTS.md approach supported natively by Cursor.
 * See: https://docs.cursor.com/en/cli/using
 */
export class CursorAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'cursor';
  }

  getName(): string {
    return 'Cursor';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    _rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
    _ruleFiles?: { path: string; content: string }[],
    rulerDir?: string,
    mergeStrategy?: 'all' | 'cursor',
  ): Promise<void> {
    // Write AGENTS.md via base class
    // Cursor natively reads AGENTS.md from the project root
    await super.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null,
      {
        outputPath: agentConfig?.outputPath,
      },
      backup,
    );

    // Copy .claude/rules to .cursor/rules when using cursor merge strategy
    if (mergeStrategy === 'cursor' && rulerDir) {
      const rulerDirName = path.basename(rulerDir);
      if (rulerDirName === '.claude') {
        const sourceRulesDir = path.join(rulerDir, 'rules');
        const targetRulesDir = path.join(projectRoot, '.cursor', 'rules');

        // Check if source rules directory exists
        try {
          await fs.access(sourceRulesDir);

          // Copy the entire rules directory
          await fs.mkdir(path.dirname(targetRulesDir), { recursive: true });
          await fs.rm(targetRulesDir, { recursive: true, force: true });
          await copySkillsDirectory(sourceRulesDir, targetRulesDir);
        } catch {
          // Source rules directory doesn't exist, skip copying
        }
      }
    }
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
