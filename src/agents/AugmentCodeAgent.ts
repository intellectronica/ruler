import * as path from 'path';
import { promises as fs } from 'fs';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import { mergeMcp } from '../mcp/merge';

/**
 * AugmentCode agent adapter.
 * Generates .augment-guidelines configuration file and supports MCP server configuration.
 */
export class AugmentCodeAgent implements IAgent {
  getIdentifier(): string {
    return 'augmentcode';
  }

  getName(): string {
    return 'AugmentCode';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await backupFile(output);
    await writeGeneratedFile(output, concatenatedRules);

    // Handle MCP configuration if provided
    if (rulerMcpJson) {
      const configPath = path.join(projectRoot, '.augmentcode', 'config.json');
      let existingConfig: Record<string, unknown> = {};

      try {
        const existingConfigRaw = await fs.readFile(configPath, 'utf8');
        existingConfig = JSON.parse(existingConfigRaw);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      const merged = mergeMcp(
        existingConfig,
        rulerMcpJson,
        agentConfig?.mcp?.strategy ?? 'merge',
        this.getMcpServerKey(),
      );

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(merged, null, 2));
    }
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.augment-guidelines');
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }
}
