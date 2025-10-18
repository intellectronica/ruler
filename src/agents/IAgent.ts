/**
 * Interface defining an AI agent configuration adapter.
 */
import { McpConfig, CommandConfig } from '../types';
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
   */
  applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup?: boolean,
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
   * Applies custom commands to the agent's command directory.
   * @param commands Command configurations from ruler.toml
   * @param commandContents Command markdown file contents
   * @param projectRoot The root directory of the project
   * @param backup Whether to backup existing files
   */
  applyCommands?(
    commands: Record<string, CommandConfig>,
    commandContents: Record<string, string>,
    projectRoot: string,
    backup?: boolean,
  ): Promise<void>;
}
