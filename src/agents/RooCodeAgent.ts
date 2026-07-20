import * as path from 'path';
import { promises as fs } from 'fs';
import { IAgent, IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import {
  assertManagedPathInsideRoot,
  backupFile,
  ensureDirExists,
  writeGeneratedFile,
} from '../core/FileSystemUtils';
import { mergeMcp } from '../mcp/merge';
import { writeMcpProvenance } from '../paths/mcp';

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

    if (agentConfig?.mcp?.enabled === false) {
      return;
    }

    // Now handle .roo/mcp.json configuration
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const mcpPath = path.resolve(
      projectRoot,
      agentConfig?.outputPathConfig ?? outputPaths['mcp'],
    );

    await assertManagedPathInsideRoot(
      mcpPath,
      projectRoot,
      'Refusing to write generated file outside project',
    );
    await ensureDirExists(path.dirname(mcpPath));

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

    const finalMcpConfig = rulerMcpJson
      ? mergeMcp(
          existingConfig,
          rulerMcpJson,
          agentConfig?.mcp?.strategy ?? 'merge',
          'mcpServers',
        )
      : {
          mcpServers:
            (existingConfig.mcpServers as Record<string, unknown>) || {},
        };

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
      await backupFile(mcpPath, projectRoot);
    }
    await writeGeneratedFile(mcpPath, newContent, projectRoot);
    if (existingContent === null) {
      await writeMcpProvenance(mcpPath, projectRoot);
    }
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

  supportsNativeSkills(): boolean {
    return true;
  }
}
