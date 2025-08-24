import { promises as fs } from 'fs';
import * as path from 'path';
import { sha256, stableJson } from './hash';
import {
  RulerUnifiedConfig,
  ConfigMeta,
  TomlConfig,
  RulesBundle,
  McpBundle,
  EffectiveAgentConfig,
  ConfigDiagnostic,
} from './UnifiedConfigTypes';

// Placeholder implementation to satisfy initial test compilation.

export interface UnifiedLoadOptions {
  projectRoot: string;
  configPath?: string;
  cliAgents?: string[];
  cliMcpEnabled?: boolean;
  cliMcpStrategy?: string;
}

export async function loadUnifiedConfig(
  options: UnifiedLoadOptions,
): Promise<RulerUnifiedConfig> {
  const meta: ConfigMeta = {
    projectRoot: options.projectRoot,
    rulerDir: path.join(options.projectRoot, '.ruler'),
    loadedAt: new Date(),
    version: '0.0.0-dev',
  };

  const toml: TomlConfig = {
    raw: {},
    schemaVersion: 1,
    agents: {},
  };

  const rules: RulesBundle = {
    files: [],
    concatenated: '',
    concatenatedHash: sha256(''),
  };

  const diagnostics: ConfigDiagnostic[] = [];

  const config: RulerUnifiedConfig = {
    meta,
    toml,
    rules,
    mcp: null as McpBundle | null,
    agents: {},
    diagnostics,
    hash: sha256(stableJson({})),
  };

  return config;
}
