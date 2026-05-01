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
  /** Write managed ignore entries to .git/info/exclude instead of .gitignore. */
  local?: boolean;
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

/** Subagents configuration for automatic subagent distribution. */
export interface SubagentsConfig {
  /** Enable or disable subagents support. */
  enabled?: boolean;
  /**
   * When true, `.ruler/agents/*.md` are also concatenated into the
   * generated top-level rule files (CLAUDE.md, AGENTS.md, Copilot
   * instructions, etc.). When false (default), `.ruler/agents/` is
   * skipped during rule concatenation, mirroring `.ruler/skills/`.
   */
  include_in_rules?: boolean;
}

/** Frontmatter fields recognised on a source subagent definition. */
export interface SubagentFrontmatter {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  readonly?: boolean;
  is_background?: boolean;
}

/** Information about a discovered subagent. */
export interface SubagentInfo {
  /** Name of the subagent (filename stem and frontmatter `name`). */
  name: string;
  /** Absolute path to the source `.md` file. */
  path: string;
  /** Parsed frontmatter (only present when valid). */
  frontmatter?: SubagentFrontmatter;
  /** Body content after the frontmatter delimiter. */
  body?: string;
  /** Whether this subagent passed validation. */
  valid: boolean;
  /** Error message if invalid. */
  error?: string;
}
