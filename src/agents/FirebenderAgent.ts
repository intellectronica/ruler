import * as path from 'path';
import * as fs from 'fs';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Firebender rule configuration object.
 */
interface FirebenderRule {
  filePathMatches: string;
  rulesPaths: string;
}

/**
 * Firebender configuration structure.
 */
interface FirebenderConfig {
  rules: (FirebenderRule | string)[];
  mcpServers?: Record<string, unknown>;
}

/**
 * Firebender agent adapter.
 */
export class FirebenderAgent implements IAgent {
  /**
   * Type guard function to safely check if an object is a FirebenderRule.
   */
  private isFirebenderRule(rule: unknown): rule is FirebenderRule {
    return (
      typeof rule === 'object' &&
      rule !== null &&
      'filePathMatches' in rule &&
      'rulesPaths' in rule &&
      typeof (rule as Record<string, unknown>).filePathMatches === 'string' &&
      typeof (rule as Record<string, unknown>).rulesPaths === 'string'
    );
  }

  getIdentifier(): string {
    return 'firebender';
  }

  getName(): string {
    return 'Firebender';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    const rulesPath = this.resolveOutputPath(projectRoot, agentConfig);
    await ensureDirExists(path.dirname(rulesPath));

    const firebenderConfig = await this.loadExistingConfig(rulesPath);
    const newRules = this.createRulesFromConcatenatedRules(
      concatenatedRules,
      projectRoot,
    );

    firebenderConfig.rules.push(...newRules);
    this.removeDuplicateRules(firebenderConfig);

    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      await this.handleMcpConfiguration(
        firebenderConfig,
        rulerMcpJson,
        agentConfig,
      );
    }

    await this.saveConfig(rulesPath, firebenderConfig, backup);
  }

  private resolveOutputPath(
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): string {
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const output =
      agentConfig?.outputPath ??
      agentConfig?.outputPathInstructions ??
      outputPaths['instructions'];
    return path.resolve(projectRoot, output);
  }

  private async loadExistingConfig(
    rulesPath: string,
  ): Promise<FirebenderConfig> {
    try {
      const existingContent = await fs.promises.readFile(rulesPath, 'utf8');
      const config = JSON.parse(existingContent);

      if (!config.rules) {
        config.rules = [];
      }

      return config;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        return { rules: [] };
      }
      console.warn(`Failed to read/parse existing firebender.json: ${error}`);
      return { rules: [] };
    }
  }

  private createRulesFromConcatenatedRules(
    concatenatedRules: string,
    projectRoot: string,
  ): (FirebenderRule | string)[] {
    const filePaths = this.extractFilePathsFromRules(
      concatenatedRules,
      projectRoot,
    );

    if (filePaths.length > 0) {
      return this.createRuleObjectsFromFilePaths(filePaths);
    } else {
      return this.createRulesFromPlainText(concatenatedRules);
    }
  }

  private createRuleObjectsFromFilePaths(
    filePaths: string[],
  ): FirebenderRule[] {
    return filePaths.map((filePath) => ({
      filePathMatches: '**/*',
      rulesPaths: filePath,
    }));
  }

  private createRulesFromPlainText(concatenatedRules: string): string[] {
    return concatenatedRules.split('\n').filter((rule) => rule.trim());
  }

  private removeDuplicateRules(firebenderConfig: FirebenderConfig): void {
    const seen = new Set<string>();
    firebenderConfig.rules = firebenderConfig.rules.filter(
      (rule: FirebenderRule | string) => {
        let key: string;
        if (this.isFirebenderRule(rule)) {
          const filePathMatchesPart = rule.filePathMatches;
          const rulesPathsPart = rule.rulesPaths;
          key = `${filePathMatchesPart}::${rulesPathsPart}`;
        } else {
          key = String(rule);
        }

        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      },
    );
  }

  private async saveConfig(
    rulesPath: string,
    config: FirebenderConfig,
    backup: boolean,
  ): Promise<void> {
    const updatedContent = JSON.stringify(config, null, 2);

    if (backup) {
      await backupFile(rulesPath);
    }

    await writeGeneratedFile(rulesPath, updatedContent);
  }

  /**
   * Handle MCP server configuration for Firebender.
   * Merges or overwrites MCP servers in the firebender.json configuration based on strategy.
   */
  private async handleMcpConfiguration(
    firebenderConfig: FirebenderConfig,
    rulerMcpJson: Record<string, unknown>,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const strategy = agentConfig?.mcp?.strategy ?? 'merge';

    const incomingServers =
      (rulerMcpJson.mcpServers as Record<string, unknown>) || {};

    if (!firebenderConfig.mcpServers) {
      firebenderConfig.mcpServers = {};
    }

    if (strategy === 'overwrite') {
      firebenderConfig.mcpServers = { ...incomingServers };
    } else if (strategy === 'merge') {
      const existingServers = firebenderConfig.mcpServers || {};
      firebenderConfig.mcpServers = { ...existingServers, ...incomingServers };
    }
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'firebender.json'),
      mcp: path.join(projectRoot, 'firebender.json'),
    };
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  /**
   * Extracts file paths from concatenated rules by parsing HTML source comments.
   * @param concatenatedRules The concatenated rules string with HTML comments
   * @param projectRoot The project root directory
   * @returns Array of file paths relative to project root
   */
  private extractFilePathsFromRules(
    concatenatedRules: string,
    projectRoot: string,
  ): string[] {
    const sourceCommentRegex = /<!-- Source: (.+?) -->/g;
    const filePaths: string[] = [];
    let match;

    while ((match = sourceCommentRegex.exec(concatenatedRules)) !== null) {
      const relativePath = match[1];
      const absolutePath = path.resolve(projectRoot, relativePath);

      const normalizedProjectRoot = path.resolve(projectRoot);
      // Ensure the absolutePath is within the project root (cross-platform compatible)
      // This prevents path traversal attacks while handling Windows/Unix path differences
      const isWithinProject =
        absolutePath.startsWith(normalizedProjectRoot) &&
        (absolutePath.length === normalizedProjectRoot.length ||
          absolutePath[normalizedProjectRoot.length] === path.sep);
      if (isWithinProject) {
        const projectRelativePath = path.relative(projectRoot, absolutePath);
        filePaths.push(projectRelativePath);
      }
    }

    return filePaths;
  }
}
