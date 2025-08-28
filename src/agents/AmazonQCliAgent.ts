import * as path from 'path';
import { promises as fs } from 'fs';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';
import { mergeMcp } from '../mcp/merge';

/**
 * Amazon Q CLI agent adapter.
 */
export class AmazonQCliAgent implements IAgent {
  getIdentifier(): string {
    return 'amazonqcli';
  }

  getName(): string {
    return 'Amazon Q CLI';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const rulesPath = path.resolve(
      projectRoot,
      agentConfig?.outputPath ||
        agentConfig?.outputPathInstructions ||
        outputPaths['instructions'],
    );

    // Write rules file to .amazonq/rules/
    await ensureDirExists(path.dirname(rulesPath));
    if (backup) {
      await backupFile(rulesPath);
    }
    await writeGeneratedFile(rulesPath, concatenatedRules);

    // Handle MCP configuration if enabled and provided
    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      const mcpPath = path.resolve(
        projectRoot,
        agentConfig?.outputPathConfig ?? outputPaths['mcp'],
      );
      const mcpStrategy = agentConfig?.mcp?.strategy ?? 'merge';

      await ensureDirExists(path.dirname(mcpPath));

      let existingMcpConfig: Record<string, unknown> = {};
      try {
        const raw = await fs.readFile(mcpPath, 'utf8');
        existingMcpConfig = JSON.parse(raw);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
        // File doesn't exist, start with empty config
      }

      // Merge the MCP configurations using the standard merge function
      const mergedConfig = mergeMcp(
        existingMcpConfig,
        rulerMcpJson,
        mcpStrategy,
        'mcpServers',
      );

      if (backup) {
        await backupFile(mcpPath);
      }
      await writeGeneratedFile(mcpPath, JSON.stringify(mergedConfig, null, 2));
    }
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(
        projectRoot,
        '.amazonq',
        'rules',
        'ruler_q_rules.md',
      ),
      mcp: path.join(projectRoot, '.amazonq', 'mcp.json'),
    };
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
