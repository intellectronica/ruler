import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * Cline agent adapter (stub implementation).
 */
export class ClineAgent implements IAgent {
  getIdentifier(): string {
    return 'cline';
  }

  getName(): string {
    return 'Cline';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await backupFile(output, agentConfig?.disableBackup);
    await writeGeneratedFile(output, concatenatedRules);
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.clinerules');
  }
}
