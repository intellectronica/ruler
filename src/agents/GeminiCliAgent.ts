import { IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentsMdAgent } from './AgentsMdAgent';

export class GeminiCliAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'gemini-cli';
  }

  getName(): string {
    return 'Gemini CLI';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // First, perform idempotent write of AGENTS.md via base class
    await super.applyRulerConfig(concatenatedRules, projectRoot, null, {
      outputPath: agentConfig?.outputPath,
    });

    // Prepare .gemini/settings.json with contextFileName and MCP configuration
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    let existingSettings: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      existingSettings = JSON.parse(raw);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    const updated = {
      ...existingSettings,
      contextFileName: 'AGENTS.md',
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

    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(updated, null, 2));
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
