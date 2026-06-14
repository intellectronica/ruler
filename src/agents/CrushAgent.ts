import { IAgent, IAgentConfig } from './IAgent';
import * as fs from 'fs/promises';
import * as path from 'path';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

export class CrushAgent implements IAgent {
  getIdentifier(): string {
    return 'crush';
  }

  getName(): string {
    return 'Crush';
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'CRUSH.md'),
      mcp: path.join(projectRoot, '.crush.json'),
    };
  }

  /**
   * Transform MCP server types for Crush compatibility.
   * Crush expects "http" for HTTP servers and "sse" for SSE servers, not "remote".
   */
  private transformMcpServersForCrush(
    mcpServers: Record<string, unknown>,
  ): Record<string, unknown> {
    const transformedServers: Record<string, unknown> = {};

    for (const [name, serverDef] of Object.entries(mcpServers)) {
      if (serverDef && typeof serverDef === 'object') {
        const server = serverDef as Record<string, unknown>;
        const transformedServer = { ...server };

        // Transform type: "remote" to appropriate Crush types
        if (
          server.type === 'remote' &&
          server.url &&
          typeof server.url === 'string'
        ) {
          const url = server.url as string;

          // Check if URL suggests SSE (contains /sse path segment)
          if (/\/sse(\/|$)/i.test(url)) {
            transformedServer.type = 'sse';
          } else {
            transformedServer.type = 'http';
          }
        }

        transformedServers[name] = transformedServer;
      } else {
        transformedServers[name] = serverDef;
      }
    }

    return transformedServers;
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const instructionsPath = path.resolve(
      projectRoot,
      agentConfig?.outputPath ??
        agentConfig?.outputPathInstructions ??
        outputPaths['instructions'],
    );
    const mcpPath = path.resolve(
      projectRoot,
      agentConfig?.outputPathConfig ?? outputPaths['mcp'],
    );

    await fs.mkdir(path.dirname(instructionsPath), { recursive: true });
    if (backup) {
      await backupFile(instructionsPath);
    }
    await writeGeneratedFile(instructionsPath, concatenatedRules);

    // Always transform from mcpServers ({ mcpServers: ... }) to { mcp: ... } for Crush
    let finalMcpConfig: { mcp: Record<string, unknown> } = { mcp: {} };

    const strategy = agentConfig?.mcp?.strategy ?? 'merge';

    try {
      const existingMcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));
      if (existingMcpConfig && typeof existingMcpConfig === 'object') {
        const transformedServers = this.transformMcpServersForCrush(
          (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        );
        finalMcpConfig = {
          ...existingMcpConfig,
          mcp: {
            ...(strategy === 'merge' ? existingMcpConfig.mcp || {} : {}),
            ...transformedServers,
          },
        };
      } else if (rulerMcpJson) {
        const transformedServers = this.transformMcpServersForCrush(
          (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        );
        finalMcpConfig = {
          mcp: transformedServers,
        };
      }
    } catch {
      if (rulerMcpJson) {
        const transformedServers = this.transformMcpServersForCrush(
          (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        );
        finalMcpConfig = {
          mcp: transformedServers,
        };
      }
    }

    if (Object.keys(finalMcpConfig.mcp).length > 0) {
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      if (backup) {
        await backupFile(mcpPath);
      }
      await writeGeneratedFile(
        mcpPath,
        JSON.stringify(finalMcpConfig, null, 2),
      );
    }
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
