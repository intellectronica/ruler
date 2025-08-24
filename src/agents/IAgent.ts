/**
 * Interface defining an AI agent configuration adapter.
 */
import { McpConfig } from '../types';
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
   * Returns whether this agent supports local (STDIO) MCP servers.
   * Defaults to true if not implemented.
   */
  supportsLocalMcp?(): boolean;

  /**
   * Returns whether this agent supports remote (HTTP) MCP servers.
   * Defaults to true if not implemented.
   */
  supportsRemoteMcp?(): boolean;

  /**
   * Returns whether this agent supports MCP servers at all.
   * Defaults to true if not implemented.
   */
  supportsMcp?(): boolean;
}
