/**
 * Types for Model Context Protocol (MCP) server configuration.
 */
export type McpStrategy = 'merge' | 'overwrite';

/** MCP configuration for an agent or global. */
export interface McpConfig {
  /** Enable or disable MCP propagation (merge or overwrite). */
  enabled?: boolean;
  /** Merge strategy: 'merge' to merge servers, 'overwrite' to replace config. */
  strategy?: McpStrategy;
}

/** Global MCP configuration section (same as agent-specific config). */
export type GlobalMcpConfig = McpConfig;

/** Gitignore configuration for automatic .gitignore file updates. */
export interface GitignoreConfig {
  /** Enable or disable automatic .gitignore updates. */
  enabled?: boolean;
}

/** Custom command configuration. */
export interface CustomCommand {
  /** Display name for the command. */
  name: string;
  /** Description of what the command does. */
  description: string;
  /** The prompt/instruction text for the command. */
  prompt: string;
  /** Command type - determines how it's implemented by different agents. */
  type?: 'slash' | 'workflow' | 'prompt-file' | 'instruction';
  /** Additional metadata for agent-specific command generation. */
  metadata?: Record<string, unknown>;
}

/** Custom commands configuration section. */
export interface CustomCommandsConfig {
  /** Map of command identifiers to command definitions. */
  [commandId: string]: CustomCommand;
}
