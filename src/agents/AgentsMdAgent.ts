import * as path from 'path';
import { promises as fs } from 'fs';
import { AbstractAgent } from './AbstractAgent';
import { IAgentConfig } from './IAgent';
import { backupFile, ensureDirExists, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * Pseudo-agent that ensures the concatenated rules are written to `.ruler/AGENTS.md`.
 * Does not participate in MCP propagation. Idempotent: only writes (and creates a backup)
 * when content differs from existing file.
 */
export class AgentsMdAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'agentsmd';
  }

  getName(): string {
    return 'AgentsMd';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.ruler', 'AGENTS.md');
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output = agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);
    await ensureDirExists(path.dirname(absolutePath));

    // Read existing content if present and skip write if identical
    let existing: string | null = null;
    try {
      existing = await fs.readFile(absolutePath, 'utf8');
    } catch {
      existing = null;
    }

    if (existing !== null && existing === concatenatedRules) {
      // No change; skip backup/write for idempotency
      return;
    }

    // Backup (only if file existed) then write new content
    await backupFile(absolutePath);
    await writeGeneratedFile(absolutePath, concatenatedRules);
  }

  getMcpServerKey(): string {
    // No MCP configuration for this pseudo-agent
    return '';
  }
}
