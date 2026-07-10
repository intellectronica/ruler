import { IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentsMdAgent } from './AgentsMdAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import { writeMcpProvenance } from '../paths/mcp';

export class GeminiCliAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'gemini-cli';
  }

  getName(): string {
    return 'Gemini CLI';
  }

  private getContextFileName(projectRoot: string, agentConfig?: IAgentConfig) {
    const outputPath = agentConfig?.outputPath ?? 'AGENTS.md';
    return path
      .relative(projectRoot, path.resolve(projectRoot, outputPath))
      .replace(/\\/g, '/');
  }

  private getSettingsPath(projectRoot: string, agentConfig?: IAgentConfig) {
    return path.resolve(
      projectRoot,
      agentConfig?.outputPathConfig ?? path.join('.gemini', 'settings.json'),
    );
  }

  getAdditionalOutputPaths(
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): string[] {
    return [this.getSettingsPath(projectRoot, agentConfig)];
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    // First, perform idempotent write of AGENTS.md via base class
    await super.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null,
      {
        outputPath: agentConfig?.outputPath,
      },
      backup,
    );

    // Prepare settings with contextFileName and MCP configuration
    const settingsPath = this.getSettingsPath(projectRoot, agentConfig);
    let existingSettings: Record<string, unknown> = {};
    let existingContent: string | null = null;
    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      existingContent = raw;
      existingSettings = JSON.parse(raw);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    const updated = {
      ...existingSettings,
      contextFileName: this.getContextFileName(projectRoot, agentConfig),
    } as Record<string, unknown>;

    // Handle MCP server configuration if provided
    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';

      // Gemini CLI (since v0.21.0) no longer accepts the "type" field in MCP server entries.
      // Following the MCP spec update from Nov 25, 2025, the transport type is now inferred
      // from the presence of specific keys (command/args -> stdio, url -> sse/http).
      // Strip 'type' field from all incoming servers before merging.
      const stripTypeField = (
        servers: Record<string, unknown>,
      ): Record<string, unknown> => {
        const cleaned: Record<string, unknown> = {};
        for (const [name, def] of Object.entries(servers)) {
          if (def && typeof def === 'object') {
            const copy = { ...(def as Record<string, unknown>) };
            delete copy.type;
            cleaned[name] = copy;
          } else {
            cleaned[name] = def;
          }
        }
        return cleaned;
      };

      if (strategy === 'overwrite') {
        // For overwrite, preserve existing settings except MCP servers
        const incomingServers =
          (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
        updated[this.getMcpServerKey()] = stripTypeField(incomingServers);
      } else {
        // For merge strategy, merge with existing MCP servers
        const baseServers =
          (existingSettings[this.getMcpServerKey()] as Record<
            string,
            unknown
          >) || {};
        const incomingServers =
          (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
        const mergedServers = { ...baseServers, ...incomingServers };
        updated[this.getMcpServerKey()] = stripTypeField(mergedServers);
      }
    }

    const nextContent = JSON.stringify(updated, null, 2);
    if (existingContent === nextContent) {
      return;
    }

    if (backup && existingContent !== null) {
      await backupFile(settingsPath, projectRoot);
    }

    await writeGeneratedFile(settingsPath, nextContent, projectRoot);
    if (existingContent === null) {
      await writeMcpProvenance(settingsPath, projectRoot);
    }
  }

  // Ensure MCP merging uses the correct key for Gemini (.gemini/settings.json)
  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  supportsNativeSkills(): boolean {
    return true;
  }
}
