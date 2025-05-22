import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * Cline agent adapter (stub implementation).
 */
export class ClineAgent implements IAgent {
  getName(): string {
    return 'Cline';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await backupFile(output);
    await writeGeneratedFile(output, concatenatedRules);
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.clinerules');
  }
}
