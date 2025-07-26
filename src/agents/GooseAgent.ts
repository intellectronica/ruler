import * as path from 'path';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import { McpStrategy } from '../types';

/**
 * Goose agent adapter for Block's Goose AI assistant.
 * Propagates rules to .goosehints and MCP config to .goose/config.yaml
 */
export class GooseAgent implements IAgent {
  getIdentifier(): string {
    return 'goose';
  }

  getName(): string {
    return 'Goose';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // Get the output paths
    const outputPaths = this.getDefaultOutputPath(projectRoot) as Record<
      string,
      string
    >;
    const hintsPath = agentConfig?.outputPathInstructions ?? outputPaths.hints;
    const configPath = agentConfig?.outputPathConfig ?? outputPaths.config;

    // Write rules to .goosehints
    await backupFile(hintsPath);
    await writeGeneratedFile(hintsPath, concatenatedRules);

    // Ensure .goose directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });

    // Prepare default config if none exists
    let existingConfig: Record<string, unknown> = {};
    try {
      const existingConfigRaw = await fs.readFile(configPath, 'utf8');
      existingConfig = yaml.load(existingConfigRaw) as Record<string, unknown>;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Initialize with default config if file doesn't exist
      existingConfig = {
        GOOSE_PROVIDER: 'openai',
        GOOSE_MODEL: 'gpt-4o',
        extensions: {},
      };
    }

    // Handle MCP configuration
    if (rulerMcpJson && rulerMcpJson.mcpServers) {
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';
      const updatedConfig = this.mergeMcpConfig(
        existingConfig,
        rulerMcpJson,
        strategy,
      );
      await backupFile(configPath);
      await writeGeneratedFile(
        configPath,
        yaml.dump(updatedConfig, { sortKeys: false }),
      );
    } else {
      // If no MCP config provided, just ensure the config file exists with defaults
      await backupFile(configPath);
      await writeGeneratedFile(
        configPath,
        yaml.dump(existingConfig, { sortKeys: false }),
      );
    }
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      hints: path.join(projectRoot, '.goosehints'),
      config: path.join(projectRoot, '.goose', 'config.yaml'),
    };
  }

  getMcpServerKey(): string {
    return 'extensions';
  }

  /**
   * Merges MCP configuration into Goose's config.yaml format
   */
  private mergeMcpConfig(
    existingConfig: Record<string, unknown>,
    rulerMcpJson: Record<string, unknown>,
    strategy: McpStrategy,
  ): Record<string, unknown> {
    const mcpServers = rulerMcpJson.mcpServers as Record<string, unknown>;

    // Create a copy of the existing config to modify
    const updatedConfig = { ...existingConfig };

    // Ensure extensions object exists
    if (!updatedConfig.extensions) {
      updatedConfig.extensions = {};
    }

    if (strategy === 'overwrite') {
      // Replace all extensions with the new ones
      updatedConfig.extensions = { ...mcpServers };
    } else {
      // Merge with existing extensions
      updatedConfig.extensions = {
        ...(updatedConfig.extensions as Record<string, unknown>),
        ...mcpServers,
      };
    }

    return updatedConfig;
  }
}
