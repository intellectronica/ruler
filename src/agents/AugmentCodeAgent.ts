import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * AugmentCode agent adapter.
 * Generates ruler_augment_instructions.md configuration file and updates VSCode settings.json with MCP server configuration.
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
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await backupFile(output);
    await writeGeneratedFile(output, concatenatedRules);

    // AugmentCode does not support MCP servers
    // MCP configuration is ignored for this agent
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.augment',
      'rules',
      'ruler_augment_instructions.md',
    );
  }

  // AugmentCode does not support MCP servers
  supportsMcpStdio(): boolean {
    return false;
  }

  supportsMcpRemote(): boolean {
    return false;
  }
}
