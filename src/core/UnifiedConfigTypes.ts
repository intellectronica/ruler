import {
  McpConfig,
  GitignoreConfig,
  SkillsConfig,
  McpStrategy,
} from '../types';

export interface RulerUnifiedConfig {
  meta: ConfigMeta;
  toml: TomlConfig;
  rules: RulesBundle;
  mcp: McpBundle | null;
  agents: Record<string, EffectiveAgentConfig>;
  diagnostics: ConfigDiagnostic[];
  hash: string;
}

export interface ConfigMeta {
  projectRoot: string;
  rulerDir: string;
  configFile?: string;
  mcpFile?: string;
  loadedAt: Date;
  version: string;
}

export interface TomlConfig {
  raw: unknown;
  schemaVersion: number;
  defaultAgents?: string[];
  agents: Record<string, AgentTomlConfig>;
  mcp?: McpToggleConfig;
  mcpServers?: Record<string, McpServerDef>;
  gitignore?: GitignoreConfig;
  skills?: SkillsConfig;
  nested?: boolean;
}

export type McpToggleConfig = McpConfig;

export interface AgentTomlConfig {
  enabled?: boolean;
  outputPath?: string;
  outputPathInstructions?: string;
  outputPathConfig?: string;
  mcp?: McpConfig;
  source: AgentConfigSourceMeta;
}

export interface AgentConfigSourceMeta {
  sectionPath: string;
}

export interface RulesBundle {
  files: RuleFile[];
  concatenated: string;
  concatenatedHash: string;
}

export interface RuleFile {
  path: string;
  relativePath: string;
  content: string;
  contentHash: string;
  mtimeMs: number;
  size: number;
  order: number;
  primary: boolean;
}

export interface McpBundle {
  servers: Record<string, McpServerDef>;
  raw: Record<string, unknown>;
  hash: string;
}

export interface McpServerDef {
  type?: 'stdio' | 'local' | 'remote';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface EffectiveAgentConfig {
  identifier: string;
  enabled: boolean;
  output: AgentOutputPaths;
  mcp: EffectiveMcpConfig;
  toml?: AgentTomlConfig;
}

export interface AgentOutputPaths {
  instructions?: string;
  config?: string;
  generic?: string;
}

export interface EffectiveMcpConfig {
  enabled: boolean;
  strategy: McpStrategy;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface ConfigDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  file?: string;
  detail?: string;
}
