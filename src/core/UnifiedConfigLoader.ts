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
  McpServerDef,
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

  let defaultAgents: string[] | undefined;
  if (
    tomlRaw &&
    typeof tomlRaw === 'object' &&
    (tomlRaw as Record<string, unknown>).default_agents &&
    Array.isArray((tomlRaw as Record<string, unknown>).default_agents)
  ) {
    defaultAgents = (
      (tomlRaw as Record<string, unknown>).default_agents as unknown[]
    ).map((a) => String(a));
  }
  const toml: TomlConfig = {
    raw: tomlRaw,
    schemaVersion: 1,
    agents: {},
    defaultAgents,
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

  // MCP normalization
  let mcp: McpBundle | null = null;
  const mcpFile = path.join(meta.rulerDir, 'mcp.json');
  try {
    const raw = await fs.readFile(mcpFile, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    meta.mcpFile = mcpFile;
    const parsedObj = parsed as Record<string, unknown>;
    const serversRaw =
      (parsedObj.mcpServers as unknown) || (parsedObj.servers as unknown) || {};
    const servers: Record<string, McpServerDef> = {};
    if (serversRaw && typeof serversRaw === 'object') {
      for (const [name, def] of Object.entries(
        serversRaw as Record<string, Record<string, unknown>>,
      )) {
        if (!def || typeof def !== 'object') continue;
        const server: McpServerDef = {};
        if (typeof def.command === 'string') server.command = def.command;
        if (Array.isArray(def.command)) server.command = def.command[0];
        if (Array.isArray(def.args)) server.args = def.args.map(String);
        if (def.env && typeof def.env === 'object') {
          server.env = Object.fromEntries(
            Object.entries(def.env).filter(([, v]) => typeof v === 'string'),
          ) as Record<string, string>;
        }
        if (typeof def.url === 'string') server.url = def.url;
        if (def.headers && typeof def.headers === 'object') {
          server.headers = Object.fromEntries(
            Object.entries(def.headers).filter(
              ([, v]) => typeof v === 'string',
            ),
          ) as Record<string, string>;
        }
        // Derive type
        if (server.url) server.type = 'remote';
        else if (server.command) server.type = 'stdio';
        servers[name] = server;
      }
    }
    mcp = {
      servers,
      raw: parsed,
      hash: sha256(stableJson(servers)),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      diagnostics.push({
        severity: 'warning',
        code: 'MCP_READ_ERROR',
        message: 'Failed to read mcp.json',
        file: mcpFile,
        detail: (err as Error).message,
      });
    }
  }

  const config: RulerUnifiedConfig = {
    meta,
    toml,
    rules,
    mcp,
    agents: {},
    diagnostics,
    hash: '', // placeholder, recompute after agents
  };

  // Agent resolution (basic): enabled set is CLI override or default_agents
  const cliAgents =
    options.cliAgents && options.cliAgents.length > 0
      ? options.cliAgents
      : undefined;
  const enabledList = cliAgents ?? toml.defaultAgents ?? [];
  for (const name of enabledList) {
    config.agents[name] = {
      identifier: name,
      enabled: true,
      output: {},
      mcp: { enabled: false, strategy: 'merge' },
    };
  }
  // If CLI provided, mark defaults not included as disabled (optional design choice)
  if (cliAgents) {
    for (const name of toml.defaultAgents ?? []) {
      if (!config.agents[name]) {
        config.agents[name] = {
          identifier: name,
          enabled: false,
          output: {},
          mcp: { enabled: false, strategy: 'merge' },
        };
      }
    }
  }

  // Recompute hash including agents list
  config.hash = sha256(
    stableJson({
      toml: toml.defaultAgents,
      rules: rules.concatenatedHash,
      mcp: mcp ? mcp.hash : null,
      agents: Object.entries(config.agents).map(([k, v]) => [k, v.enabled]),
    }),
  );

  return config;
}
