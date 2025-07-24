import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

/**
 * Aider agent adapter (stub implementation).
 */
export class AiderAgent implements IAgent {
  getIdentifier(): string {
    return 'aider';
  }

  getName(): string {
    return 'Aider';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const mdPath =
      agentConfig?.outputPathInstructions ??
      this.getDefaultOutputPath(projectRoot).instructions;
    await backupFile(mdPath);
    await writeGeneratedFile(mdPath, concatenatedRules);

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
      await backupFile(cfgPath);
      const raw = await fs.readFile(cfgPath, 'utf8');
      doc = (yaml.load(raw) || {}) as AiderConfig;
    } catch {
      doc = {} as AiderConfig;
    }
    if (!Array.isArray(doc.read)) {
      doc.read = [];
    }
    const name = path.basename(mdPath);
    if (!doc.read.includes(name)) {
      doc.read.push(name);
    }
    const yamlStr = yaml.dump(doc);
    await writeGeneratedFile(cfgPath, yamlStr);
  }
  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'ruler_aider_instructions.md'),
      config: path.join(projectRoot, '.aider.conf.yml'),
    };
  }
}
