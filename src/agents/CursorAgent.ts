import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { IAgentConfig } from './IAgent';

// Cursor-specific configuration extending the base config
interface CursorAgentConfig extends IAgentConfig {
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
}
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Cursor agent adapter.
 */
export class CursorAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'cursor';
  }

  getName(): string {
    return 'Cursor';
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

    // Extract Cursor-specific config
    const cursorConfig = agentConfig as CursorAgentConfig | undefined;
    const alwaysApply = cursorConfig?.alwaysApply ?? true; // Default to true
    const description = cursorConfig?.description ?? '';
    const globs = cursorConfig?.globs ?? [];

    // Cursor expects a YAML front-matter block with an `alwaysApply` flag.
    // See: https://docs.cursor.com/context/rules#rule-anatomy
    const frontMatterLines = ['---'];
    
    // Add description if provided
    if (description) {
      frontMatterLines.push(`description: ${description}`);
    }
    
    // Add globs if provided
    if (globs.length > 0) {
      frontMatterLines.push('globs:');
    }
    
    frontMatterLines.push(`alwaysApply: ${alwaysApply}`);
    frontMatterLines.push('---', '');
    const frontMatter = frontMatterLines.join('\n');
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
      '.cursor',
      'rules',
      'ruler_cursor_instructions.mdc',
    );
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
