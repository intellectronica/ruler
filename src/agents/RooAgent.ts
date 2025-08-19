import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Roo agent adapter.
 */
export class RooAgent implements IAgent {
  getIdentifier(): string {
    return 'roo_code';
  }

  getName(): string {
    return 'Roo';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const outputPath =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await ensureDirExists(path.dirname(outputPath));
    await backupFile(outputPath);
    await writeGeneratedFile(outputPath, concatenatedRules);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.roo', 'rules', 'ruler_roo_instructions.md');
  }
}
