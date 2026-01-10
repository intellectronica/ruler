/**
 * Types for Model Context Protocol (MCP) server configuration.
 */
export type McpStrategy = 'merge' | 'overwrite';
export type HooksStrategy = 'merge' | 'overwrite';

/** MCP configuration for an agent or global. */
export interface McpConfig {
  /** Enable or disable MCP propagation (merge or overwrite). */
  enabled?: boolean;
  /** Merge strategy: 'merge' to merge servers, 'overwrite' to replace config. */
  strategy?: McpStrategy;
}

/** Hooks configuration for an agent. */
export interface HooksConfig {
  /** Enable or disable hook propagation. */
  enabled?: boolean;
  /** Merge strategy: 'merge' to append hooks, 'overwrite' to replace hooks. */
  strategy?: HooksStrategy;
  /** Path to the hooks source JSON file. */
  source?: string;
  /** Override for the agent hooks output path. */
  outputPath?: string;
}

/** Global hooks configuration section. */
export interface GlobalHooksConfig {
  /** Enable or disable hook propagation. */
  enabled?: boolean;
  /** Merge strategy: 'merge' to append hooks, 'overwrite' to replace hooks. */
  strategy?: HooksStrategy;
  /** Path to the hooks source JSON file. */
  source?: string;
}

/** Global MCP configuration section (same as agent-specific config). */
export type GlobalMcpConfig = McpConfig;

/** Gitignore configuration for automatic .gitignore file updates. */
export interface GitignoreConfig {
  /** Enable or disable automatic .gitignore updates. */
  enabled?: boolean;
}

/** Skills configuration for automatic skills distribution. */
export interface SkillsConfig {
  /** Enable or disable skills support. */
  enabled?: boolean;
}

/** Information about a discovered skill. */
export interface SkillInfo {
  /** Name of the skill (directory name). */
  name: string;
  /** Absolute path to the skill directory. */
  path: string;
  /** Whether the directory contains a SKILL.md file. */
  hasSkillMd: boolean;
  /** Whether this is a valid skill. */
  valid: boolean;
  /** Error message if invalid. */
  error?: string;
}
