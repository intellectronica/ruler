import * as path from 'path';
import { IAgent } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

/**
 * Aider agent adapter (stub implementation).
 */
export class AiderAgent implements IAgent {
  getName(): string {
    return 'Aider';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
  ): Promise<void> {
    const mdFile = path.join(projectRoot, 'ruler_aider_instructions.md');
    await backupFile(mdFile);
    await writeGeneratedFile(mdFile, concatenatedRules);

    const cfgPath = path.join(projectRoot, '.aider.conf.yml');
    let doc: any = {};
    try {
      await fs.access(cfgPath);
      await backupFile(cfgPath);
      const raw = await fs.readFile(cfgPath, 'utf8');
      doc = yaml.load(raw) || {};
    } catch {
      doc = {};
    }
    if (!Array.isArray(doc.read)) {
      doc.read = [];
    }
    if (!doc.read.includes('ruler_aider_instructions.md')) {
      doc.read.push('ruler_aider_instructions.md');
    }
    const yamlStr = yaml.dump(doc);
    await writeGeneratedFile(cfgPath, yamlStr);
  }
}
