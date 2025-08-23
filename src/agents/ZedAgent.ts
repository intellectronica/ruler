import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentsMdAgent } from './AgentsMdAgent';
import { IAgentConfig } from './IAgent';

/**
 * Zed editor agent adapter.
 * Inherits from AgentsMdAgent to write instructions to AGENTS.md and handles
 * MCP server configuration in .zed/settings.json at the project root.
 */
export class ZedAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'zed';
  }

  getName(): string {
    return 'Zed';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // First, perform idempotent AGENTS.md write via base class
    await super.applyRulerConfig(concatenatedRules, projectRoot, null, {
      outputPath: agentConfig?.outputPath,
    });

    // Handle MCP server configuration if enabled and provided
    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      const zedSettingsPath = path.join(projectRoot, '.zed', 'settings.json');

      // Read existing settings
      let existingSettings: Record<string, unknown> = {};
      try {
        const content = await fs.readFile(zedSettingsPath, 'utf8');
        existingSettings = JSON.parse(content);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, use empty settings
      }

      // Get the merge strategy
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';

      // Handle merging based on strategy
      let mergedSettings: Record<string, unknown>;

      if (strategy === 'overwrite') {
        // For overwrite, preserve all existing settings except MCP servers
        mergedSettings = { ...existingSettings };

        // Extract incoming MCP servers
        const incomingServers =
          (rulerMcpJson.mcpServers as Record<string, unknown>) || {};

        // Replace MCP servers completely
        mergedSettings[this.getMcpServerKey()] = incomingServers;
      } else {
        // For merge strategy, preserve all existing settings
        const baseServers =
          (existingSettings[this.getMcpServerKey()] as Record<
            string,
            unknown
          >) || {};
        const incomingServers =
          (rulerMcpJson.mcpServers as Record<string, unknown>) || {};

        const mergedServers = { ...baseServers, ...incomingServers };

        mergedSettings = {
          ...existingSettings,
          [this.getMcpServerKey()]: mergedServers,
        };
      }

      // Write updated settings
      await fs.mkdir(path.dirname(zedSettingsPath), { recursive: true });
      await fs.writeFile(
        zedSettingsPath,
        JSON.stringify(mergedSettings, null, 2),
      );
    }
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }
}
