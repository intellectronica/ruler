import { IAgent, IAgentConfig } from './IAgent';
import { writeGeneratedFile } from '../core/FileSystemUtils';
import * as path from 'path';

export class JulesAgent implements IAgent {
  getIdentifier(): string {
    return 'jules';
  }

  getName(): string {
    return 'Jules';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const outputPath =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, outputPath);
    await writeGeneratedFile(absolutePath, concatenatedRules);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'AGENTS.md');
  }
}
