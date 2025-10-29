import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

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
   */
  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    _rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);
    await ensureDirExists(path.dirname(absolutePath));
    if (backup) {
      await backupFile(absolutePath);
    }
    await writeGeneratedFile(absolutePath, concatenatedRules);
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
   * Returns whether this agent has native skills support.
   * Defaults to false if not overridden.
   */
  supportsNativeSkills(): boolean {
    return false;
  }
}
