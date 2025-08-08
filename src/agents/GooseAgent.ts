import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * Goose agent adapter for Block's Goose AI assistant.
 * Propagates rules to .goosehints file.
 */
export class GooseAgent implements IAgent {
  getIdentifier(): string {
    return 'goose';
  }

  getName(): string {
    return 'Goose';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // Get the output path for .goosehints
    const hintsPath =
      agentConfig?.outputPathInstructions ??
      this.getDefaultOutputPath(projectRoot);

    // Write rules to .goosehints
    await backupFile(hintsPath, agentConfig?.disableBackup);
    await writeGeneratedFile(hintsPath, concatenatedRules);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.goosehints');
  }

  getMcpServerKey(): string {
    // Goose doesn't support MCP configuration via local config files
    return '';
  }
}
