import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { CustomCommandsConfig } from '../types';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';
import { CommandProcessor } from '../core/CommandProcessor';

/**
 * Abstract base class for agents that write to a single configuration file.
 * Implements common logic for applying ruler configuration.
 */
export abstract class AbstractAgent implements IAgent {
  /**
   * Returns the lowercase identifier of the agent.
   */
  abstract getIdentifier(): string;

  /**
   * Returns the display name of the agent.
   */
  abstract getName(): string;

  /**
   * Returns the default output path for this agent given the project root.
   */
  abstract getDefaultOutputPath(projectRoot: string): string;

  /**
   * Applies the concatenated ruler rules to the agent's configuration.
   * This implementation handles the common pattern of:
   * 1. Determining the output path
   * 2. Ensuring the parent directory exists
   * 3. Backing up the existing file
   * 4. Writing the new content
   * 5. Adding custom commands (either native or fallback instructions)
   */
  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
    backup = true,
    customCommands?: CustomCommandsConfig,
  ): Promise<void> {
    let finalContent = concatenatedRules;

    // Add custom commands support
    if (customCommands && Object.keys(customCommands).length > 0) {
      if (this.supportsCustomCommands?.()) {
        // Agent supports native commands - generate them separately if needed
        const nativeCommands = await this.generateCustomCommands?.(
          customCommands,
          projectRoot,
        );
        if (nativeCommands) {
          finalContent += nativeCommands;
        }
      } else {
        // Agent doesn't support native commands - add fallback instructions
        const fallbackInstructions =
          CommandProcessor.generateFallbackInstructions(customCommands);
        finalContent += fallbackInstructions;
      }
    }

    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);
    await ensureDirExists(path.dirname(absolutePath));
    if (backup) {
      await backupFile(absolutePath);
    }
    await writeGeneratedFile(absolutePath, finalContent);
  }

  /**
   * Returns the specific key to be used for the server object in MCP JSON.
   * Defaults to 'mcpServers' if not overridden.
   */
  getMcpServerKey(): string {
    return 'mcpServers';
  }

  /**
   * Returns whether this agent supports MCP STDIO servers.
   * Defaults to false if not overridden.
   */
  supportsMcpStdio(): boolean {
    return false;
  }

  /**
   * Returns whether this agent supports MCP remote servers.
   * Defaults to false if not overridden.
   */
  supportsMcpRemote(): boolean {
    return false;
  }

  /**
   * Returns whether this agent supports native custom commands.
   * Defaults to false if not overridden.
   */
  supportsCustomCommands(): boolean {
    return false;
  }

  /**
   * Returns the supported command types for this agent.
   * Defaults to ['instruction'] if not overridden.
   */
  getSupportedCommandTypes(): string[] {
    return ['instruction'];
  }

  /**
   * Generates native command configuration for this agent.
   * Default implementation returns null (no native support).
   */
  async generateCustomCommands(
    commands: CustomCommandsConfig, // eslint-disable-line @typescript-eslint/no-unused-vars
    projectRoot: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<string | null> {
    return null;
  }
}
