import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

export class OpenHandsAgent implements IAgent {
  getIdentifier(): string {
    return 'openhands';
  }
  getName(): string {
    return 'Open Hands';
  }
  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await ensureDirExists(path.dirname(output));
    await backupFile(output, agentConfig?.disableBackup);
    await writeGeneratedFile(output, concatenatedRules);
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.openhands', 'microagents', 'repo.md');
  }
}
