import * as path from 'path';
import { promises as fs } from 'fs';
import { IAgent, IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import {
  backupFile,
  ensureDirExists,
  writeGeneratedFile,
} from '../core/FileSystemUtils';

/**
 * Agent for RooCode that writes to AGENTS.md and generates .roo/mcp.json
 * with project-level MCP server configuration.
 */
export class RooCodeAgent implements IAgent {
  private agentsMdAgent = new AgentsMdAgent();

  getIdentifier(): string {
    return 'roo';
  }

  getName(): string {
    return 'RooCode';
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'AGENTS.md'),
      mcp: path.join(projectRoot, '.roo', 'mcp.json'),
    };
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    // First perform idempotent AGENTS.md write via composed AgentsMdAgent
    await this.agentsMdAgent.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null,
      {
        // Preserve explicit outputPath precedence semantics if provided.
        outputPath:
          agentConfig?.outputPath ||
          agentConfig?.outputPathInstructions ||
          undefined,
      },
      backup,
    );

    // Now handle .roo/mcp.json configuration
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const mcpPath = path.resolve(
      projectRoot,
      agentConfig?.outputPathConfig ?? outputPaths['mcp'],
    );

    await ensureDirExists(path.dirname(mcpPath));

    // Create base structure with mcpServers
    let finalMcpConfig: { mcpServers: Record<string, unknown> } = {
      mcpServers: {},
    };

    // Try to read existing .roo/mcp.json
    let existingConfig: Record<string, unknown> = {};
    try {
      const existingContent = await fs.readFile(mcpPath, 'utf-8');
      const parsed = JSON.parse(existingContent);
      if (parsed && typeof parsed === 'object') {
        existingConfig = parsed as Record<string, unknown>;
      }
    } catch {
      // File doesn't exist or invalid JSON - start fresh
      existingConfig = {};
    }

    // Merge MCP servers if we have ruler config
    if (rulerMcpJson?.mcpServers) {
      const existingServers =
        (existingConfig.mcpServers as Record<string, unknown>) || {};
      const newServers = rulerMcpJson.mcpServers as Record<string, unknown>;

      // Shallow merge: new servers override existing with same name
      finalMcpConfig = {
        mcpServers: {
          ...existingServers,
          ...newServers,
        },
      };
    } else if (existingConfig.mcpServers) {
      // Keep existing servers if no new ones to add
      finalMcpConfig = {
        mcpServers: existingConfig.mcpServers as Record<string, unknown>,
      };
    }
    // If neither condition is met, finalMcpConfig remains { mcpServers: {} }

    // Write the config file with pretty JSON (2 spaces)
    const newContent = JSON.stringify(finalMcpConfig, null, 2);

    // Check if content has changed for idempotency
    let existingContent: string | null = null;
    try {
      existingContent = await fs.readFile(mcpPath, 'utf8');
    } catch {
      existingContent = null;
    }

    if (existingContent !== null && existingContent === newContent) {
      // No change; skip backup/write for idempotency
      return;
    }

    // Backup (only if file existed and backup is enabled) then write new content
    if (backup) {
      await backupFile(mcpPath);
    }
    await writeGeneratedFile(mcpPath, newContent);
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }
}
