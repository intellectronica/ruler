import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Windsurf agent adapter.
 */
export class WindsurfAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'windsurf';
  }

  getName(): string {
    return 'Windsurf';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);

    // Windsurf expects a YAML front-matter block with a `trigger` flag.
    const frontMatter = ['---', 'trigger: always_on', '---', ''].join('\n');
    const content = `${frontMatter}${concatenatedRules.trimStart()}`;

    await ensureDirExists(path.dirname(absolutePath));
    if (backup) {
      await backupFile(absolutePath);
    }
    await writeGeneratedFile(absolutePath, content);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.windsurf',
      'rules',
      'ruler_windsurf_instructions.md',
    );
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
