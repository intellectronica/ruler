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

/** Global configuration for command directory. */
export interface CommandDirectoryConfig {
  /** Directory name for command files (default: "commands"). */
  command_directory?: string;
}

/** Command configuration for custom commands. */
export interface CommandConfig {
  /** The command name/identifier. */
  name: string;
  /** Brief description of what the command does. */
  description: string;
  /** Inline prompt text (alternative to prompt_file). */
  prompt?: string;
  /** Relative path to the markdown file containing the command prompt (alternative to prompt). */
  prompt_file?: string;
  /** Type of command (slash, workflow, prompt-file, instruction). */
  type: 'slash' | 'workflow' | 'prompt-file' | 'instruction';
}
