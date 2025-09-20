import * as path from 'path';
import * as fs from 'fs';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Firebender agent adapter.
 */
export class FirebenderAgent implements IAgent {
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
    const newRules = this.createRulesFromConcatenatedRules(concatenatedRules, projectRoot);

    firebenderConfig.rules.push(...newRules);
    this.removeDuplicateRules(firebenderConfig);

    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      await this.handleMcpConfiguration(firebenderConfig, rulerMcpJson, agentConfig);
    }

    await this.saveConfig(rulesPath, firebenderConfig, backup);
  }

  private resolveOutputPath(projectRoot: string, agentConfig?: IAgentConfig): string {
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const output =
      agentConfig?.outputPath ??
      agentConfig?.outputPathInstructions ??
      outputPaths['instructions'];
    return path.resolve(projectRoot, output);
  }

  private async loadExistingConfig(rulesPath: string): Promise<any> {
    if (!fs.existsSync(rulesPath)) {
      return { rules: [] };
    }

    try {
      const existingContent = fs.readFileSync(rulesPath, 'utf8');
      const config = JSON.parse(existingContent);

      if (!config.rules) {
        config.rules = [];
      }

      return config;
    } catch (error) {
      console.warn(`Failed to parse existing firebender.json: ${error}`);
      return { rules: [] };
    }
  }

  private createRulesFromConcatenatedRules(concatenatedRules: string, projectRoot: string): any[] {
    const filePaths = this.extractFilePathsFromRules(concatenatedRules, projectRoot);

    if (filePaths.length > 0) {
      return this.createRuleObjectsFromFilePaths(filePaths);
    } else {
      return this.createRulesFromPlainText(concatenatedRules);
    }
  }

  private createRuleObjectsFromFilePaths(filePaths: string[]): any[] {
    return filePaths.map(filePath => ({
      filePathMatches: "**/*",
      rulesPaths: filePath
    }));
  }

  private createRulesFromPlainText(concatenatedRules: string): string[] {
    return concatenatedRules.split('\n').filter(rule => rule.trim());
  }

  private removeDuplicateRules(firebenderConfig: any): void {
    const seen = new Set();
    firebenderConfig.rules = firebenderConfig.rules.filter((rule: any) => {
      const key = typeof rule === 'object' && rule.rulesPaths ? rule.rulesPaths : rule;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async saveConfig(rulesPath: string, config: any, backup: boolean): Promise<void> {
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
    firebenderConfig: any,
    rulerMcpJson: Record<string, unknown>,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const strategy = agentConfig?.mcp?.strategy ?? 'merge';

    const incomingServers = (rulerMcpJson.mcpServers as Record<string, unknown>) || {};

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
      instructions: path.join(
        projectRoot,
        'firebender.json'
      ),
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
  private extractFilePathsFromRules(concatenatedRules: string, projectRoot: string): string[] {
    const sourceCommentRegex = /<!-- Source: (.+?) -->/g;
    const filePaths: string[] = [];
    let match;

    while ((match = sourceCommentRegex.exec(concatenatedRules)) !== null) {
      const relativePath = match[1];
      const absolutePath = path.resolve(projectRoot, relativePath);
      const projectRelativePath = path.relative(projectRoot, absolutePath);
      filePaths.push(projectRelativePath);
    }

    return filePaths;
  }
}