import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

/**
 * Aider agent adapter that uses AGENTS.md for instructions and .aider.conf.yml for configuration.
 */
export class AiderAgent implements IAgent {
  private agentsMdAgent = new AgentsMdAgent();
  getIdentifier(): string {
    return 'aider';
  }

  getName(): string {
    return 'Aider';
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

    // Now handle .aider.conf.yml configuration
    const cfgPath =
      agentConfig?.outputPathConfig ??
      this.getDefaultOutputPath(projectRoot).config;

    interface AiderConfig {
      read?: string[];
      [key: string]: unknown;
    }
    let doc: AiderConfig = {} as AiderConfig;
    try {
      await fs.access(cfgPath);
      if (backup) {
        await backupFile(cfgPath);
      }
      const raw = await fs.readFile(cfgPath, 'utf8');
      doc = (yaml.load(raw) || {}) as AiderConfig;
    } catch {
      doc = {} as AiderConfig;
    }
    if (!Array.isArray(doc.read)) {
      doc.read = [];
    }

    // Determine the actual agents file path (AGENTS.md by default, or custom path)
    const agentsPath =
      agentConfig?.outputPath ||
      agentConfig?.outputPathInstructions ||
      this.getDefaultOutputPath(projectRoot).instructions;
    const name = path.basename(agentsPath);

    if (!doc.read.includes(name)) {
      doc.read.push(name);
    }
    const yamlStr = yaml.dump(doc);
    await writeGeneratedFile(cfgPath, yamlStr);
  }
  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'AGENTS.md'),
      config: path.join(projectRoot, '.aider.conf.yml'),
    };
  }

  getMcpServerKey(): string {
    return this.agentsMdAgent.getMcpServerKey();
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
