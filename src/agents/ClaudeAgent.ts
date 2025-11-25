import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Claude Code agent adapter.
 * Uses @filename references instead of concatenating content.
 */
export class ClaudeAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'claude';
  }

  getName(): string {
    return 'Claude Code';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'CLAUDE.md');
  }

  /**
   * Override to write @filename references instead of concatenated content.
   * This allows Claude Code to auto-include file contents on-demand.
   */
  async applySkillerConfig(
    _concatenatedRules: string,
    projectRoot: string,
    _skillerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
    ruleFiles?: { path: string; content: string }[],
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);
    await ensureDirExists(path.dirname(absolutePath));

    if (backup) {
      await backupFile(absolutePath);
    }

    // Generate @filename references instead of concatenated content
    if (ruleFiles && ruleFiles.length > 0) {
      const references = ruleFiles
        .map((file) => {
          // Get relative path from project root
          const relativePath = path.relative(projectRoot, file.path);
          // Normalize to forward slashes for consistency
          const normalizedPath = relativePath.replace(/\\/g, '/');
          return `@${normalizedPath}`;
        })
        .join('\n');

      const content = `${references}
`;

      await writeGeneratedFile(absolutePath, content);
    } else {
      // Fallback to empty file if no rules
      await writeGeneratedFile(absolutePath, '<!-- No rules configured -->\n');
    }
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  supportsNativeSkills(): boolean {
    return true;
  }
}
