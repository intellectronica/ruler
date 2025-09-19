import { IAgent, IAgentConfig } from './IAgent';
import { CustomCommandsConfig } from '../types';
import { AgentsMdAgent } from './AgentsMdAgent';
import { CommandProcessor } from '../core/CommandProcessor';
import {
  writeGeneratedFile,
  ensureDirExists,
  backupFile,
} from '../core/FileSystemUtils';
import * as path from 'path';

/**
 * GitHub Copilot agent adapter.
 * Writes to AGENTS.md for both web-based GitHub Copilot and VS Code extension.
 */
export class CopilotAgent implements IAgent {
  private agentsMdAgent = new AgentsMdAgent();

  getIdentifier(): string {
    return 'copilot';
  }

  getName(): string {
    return 'GitHub Copilot';
  }

  /**
   * Returns the default output path for AGENTS.md.
   */
  getDefaultOutputPath(projectRoot: string): string {
    return this.agentsMdAgent.getDefaultOutputPath(projectRoot);
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
    customCommands?: CustomCommandsConfig,
  ): Promise<void> {
    // Write to AGENTS.md using the existing AgentsMdAgent infrastructure
    await this.agentsMdAgent.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null, // No MCP config needed for the instructions file
      {
        // Preserve explicit outputPath precedence semantics if provided
        outputPath:
          agentConfig?.outputPath || agentConfig?.outputPathInstructions,
      },
      backup,
      customCommands,
    );

    // Generate native prompt files for VS Code Copilot if custom commands are defined
    if (customCommands && Object.keys(customCommands).length > 0) {
      const promptFiles =
        CommandProcessor.generateCopilotPromptFiles(customCommands);

      for (const [filePath, content] of Object.entries(promptFiles)) {
        const absolutePath = path.resolve(projectRoot, filePath);
        await ensureDirExists(path.dirname(absolutePath));
        if (backup) {
          await backupFile(absolutePath);
        }
        await writeGeneratedFile(absolutePath, content);
      }
    }
  }

  getMcpServerKey(): string {
    return 'servers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  supportsCustomCommands(): boolean {
    return true;
  }

  getSupportedCommandTypes(): string[] {
    return ['prompt-file', 'instruction'];
  }

  async generateCustomCommands(
    commands: CustomCommandsConfig, // eslint-disable-line @typescript-eslint/no-unused-vars
    projectRoot: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<string | null> {
    // For Copilot, we generate prompt files separately in applyRulerConfig
    // This method could be used for additional command content if needed
    return null;
  }
}
