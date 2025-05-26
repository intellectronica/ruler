import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Windsurf agent adapter (stub implementation).
 */
export class WindsurfAgent implements IAgent {
  getIdentifier(): string {
    return 'windsurf';
  }

  getName(): string {
    return 'Windsurf';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await ensureDirExists(path.dirname(output));
    await backupFile(output);
    await writeGeneratedFile(output, concatenatedRules);
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.windsurf',
      'rules',
      'ruler_windsurf_instructions.md',
    );
  }
}
