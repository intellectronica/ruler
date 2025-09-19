/**
 * Interface defining an AI agent configuration adapter.
 */
import { McpConfig, CustomCommandsConfig } from '../types';
/**
 * Configuration overrides for a specific agent.
 */
export interface IAgentConfig {
  /** Explicit enable/disable agent */
  enabled?: boolean;
  /** Override for primary output path */
  outputPath?: string;
  /** Override for Aider instruction file path */
  outputPathInstructions?: string;
  /** Override for Aider config file path */
  outputPathConfig?: string;
  /** MCP propagation config for this agent. */
  mcp?: McpConfig;
}

export interface IAgent {
  /**
   * Returns the lowercase identifier of the agent (e.g., "copilot", "claude", "aider").
   */
  getIdentifier(): string;

  /**
   * Returns the display name of the agent.
   */
  getName(): string;

  /**
   * Applies the concatenated ruler rules to the agent's configuration.
   * @param concatenatedRules The combined rules text
   * @param projectRoot The root directory of the project
   * @param rulerMcpJson MCP configuration
   * @param agentConfig Agent-specific configuration
   * @param backup Whether to backup existing files
   * @param customCommands Custom commands configuration
   */
  applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup?: boolean,
    customCommands?: CustomCommandsConfig,
  ): Promise<void>;

  /**
   * Returns the default output path(s) for this agent given the project root.
   */
  getDefaultOutputPath(projectRoot: string): string | Record<string, string>;

  /**
   * Returns the specific key to be used for the server object in MCP JSON.
   * Defaults to 'mcpServers' if not implemented.
   */
  getMcpServerKey?(): string;

  /**
   * Returns whether this agent supports MCP STDIO servers.
   * Defaults to false if not implemented.
   */
  supportsMcpStdio?(): boolean;

  /**
   * Returns whether this agent supports MCP remote servers.
   * Defaults to false if not implemented.
   */
  supportsMcpRemote?(): boolean;

  /**
   * Returns whether this agent supports native custom commands.
   * Defaults to false if not implemented.
   */
  supportsCustomCommands?(): boolean;

  /**
   * Returns the supported command types for this agent.
   * Defaults to ['instruction'] if not implemented.
   */
  getSupportedCommandTypes?(): string[];

  /**
   * Generates native command configuration for this agent.
   * Only called if supportsCustomCommands() returns true.
   * @param commands The custom commands configuration
   * @param projectRoot The root directory of the project
   * @returns The native command configuration content or null if not supported
   */
  generateCustomCommands?(
    commands: CustomCommandsConfig,
    projectRoot: string,
  ): Promise<string | null>;
}
