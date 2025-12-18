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

/** Backup configuration for .bak file creation. */
export interface BackupConfig {
  /** Enable or disable creation of .bak backup files. */
  enabled?: boolean;
}

/** Skills configuration for automatic skills distribution. */
export interface SkillsConfig {
  /** Enable or disable skills support. */
  enabled?: boolean;
  /** Generate skills from .mdc rule files with frontmatter. */
  generate_from_rules?: boolean;
  /** Prune orphaned skills not generated from rules. true=auto-delete, false=keep, undefined=prompt. */
  prune?: boolean;
}

/** Merge strategy for rules: 'all' merges all files, 'cursor' uses Cursor-style MDC format. */
export type MergeStrategy = 'all' | 'cursor';

/** MDC frontmatter metadata (used by Cursor-style rules). */
export interface MdcFrontmatter {
  /** Description of the rule. */
  description?: string;
  /** Glob patterns this rule applies to. */
  globs?: string[];
  /** Whether this rule should always be applied. */
  alwaysApply?: boolean;
}

/** Rules configuration for filtering which markdown files to include/exclude. */
export interface RulesConfig {
  /** Glob patterns to include (if specified, only matching files are included). */
  include?: string[];
  /** Glob patterns to exclude (takes precedence over include). */
  exclude?: string[];
  /** Merge strategy: 'all' (default) merges all files, 'cursor' uses Cursor-style MDC format. */
  merge_strategy?: MergeStrategy;
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
