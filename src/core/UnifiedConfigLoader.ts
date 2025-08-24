import { promises as fs } from 'fs';
import * as path from 'path';
import * as TOML from 'toml';
import { sha256, stableJson } from './hash';
import { concatenateRules } from './RuleProcessor';
import {
  RulerUnifiedConfig,
  ConfigMeta,
  TomlConfig,
  RulesBundle,
  McpBundle,
  ConfigDiagnostic,
  RuleFile,
} from './UnifiedConfigTypes';

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

  const diagnostics: ConfigDiagnostic[] = [];

  // Read TOML if available
  let tomlRaw: unknown = {};
  const tomlFile = options.configPath
    ? path.resolve(options.configPath)
    : path.join(meta.rulerDir, 'ruler.toml');
  try {
    const text = await fs.readFile(tomlFile, 'utf8');
    tomlRaw = text.trim() ? TOML.parse(text) : {};
    meta.configFile = tomlFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      diagnostics.push({
        severity: 'warning',
        code: 'TOML_READ_ERROR',
        message: 'Failed to read ruler.toml',
        file: tomlFile,
        detail: (err as Error).message,
      });
    }
  }

  const toml: TomlConfig = {
    raw: tomlRaw,
    schemaVersion: 1,
    agents: {},
    defaultAgents: Array.isArray((tomlRaw as any)?.default_agents)
      ? (tomlRaw as any).default_agents.map((a: unknown) => String(a))
      : undefined,
  };

  // Collect rule markdown files
  let ruleFiles: RuleFile[] = [];
  try {
    const dirEntries = await fs.readdir(meta.rulerDir, { withFileTypes: true });
    const mdFiles = dirEntries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => path.join(meta.rulerDir, e.name));
    // Sort lexicographically then ensure AGENTS.md first
    mdFiles.sort((a, b) => a.localeCompare(b));
    mdFiles.sort((a, b) => {
      const aIs = /agents\.md$/i.test(a);
      const bIs = /agents\.md$/i.test(b);
      if (aIs && !bIs) return -1;
      if (bIs && !aIs) return 1;
      return 0;
    });
    let order = 0;
    ruleFiles = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(file, 'utf8');
        const stat = await fs.stat(file);
        return {
          path: file,
          relativePath: path.basename(file),
          content,
          contentHash: sha256(content),
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          order: order++,
          primary: /agents\.md$/i.test(file),
        } as RuleFile;
      }),
    );
  } catch (err) {
    diagnostics.push({
      severity: 'warning',
      code: 'RULES_READ_ERROR',
      message: 'Failed reading rule files',
      file: meta.rulerDir,
      detail: (err as Error).message,
    });
  }

  const concatenated = concatenateRules(
    ruleFiles.map((f) => ({ path: f.path, content: f.content })),
    path.dirname(meta.rulerDir),
  );
  const rules: RulesBundle = {
    files: ruleFiles,
    concatenated,
    concatenatedHash: sha256(concatenated),
  };

  const config: RulerUnifiedConfig = {
    meta,
    toml,
  rules,
    mcp: null as McpBundle | null,
    agents: {},
    diagnostics,
    hash: sha256(
      stableJson({
        toml: toml.defaultAgents,
        rules: rules.concatenatedHash,
      }),
    ),
  };

  return config;
}
