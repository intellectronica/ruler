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

      if (strategy === 'overwrite') {
        // For overwrite, preserve existing settings except MCP servers
        const incomingServers =
          (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
        updated[this.getMcpServerKey()] = incomingServers;
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
        updated[this.getMcpServerKey()] = mergedServers;
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
}
