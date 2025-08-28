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

    const maxFileSize = 10000; // 10K characters

    await ensureDirExists(path.dirname(absolutePath));
    if (backup) {
      await backupFile(absolutePath);
    }

    // Check if content exceeds the 10K limit
    if (content.length <= maxFileSize) {
      // Content fits in single file - use original behavior
      await writeGeneratedFile(absolutePath, content);
    } else {
      // Content exceeds limit - split into multiple files
      console.warn(
        `[ruler] Warning: Windsurf rule content exceeds ${maxFileSize} characters (${content.length}). Splitting into multiple files.`,
      );

      const files = this.splitContentIntoFiles(
        concatenatedRules.trimStart(),
        frontMatter,
        maxFileSize,
      );

      // Write each split file
      const rulesDir = path.dirname(absolutePath);
      const baseName = path.basename(absolutePath, '.md');

      for (let i = 0; i < files.length; i++) {
        const fileName = `${baseName}_${i}.md`;
        const filePath = path.join(rulesDir, fileName);

        if (backup) {
          await backupFile(filePath);
        }
        await writeGeneratedFile(filePath, files[i]);
      }
    }
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

  /**
   * Splits content into multiple files, each under the specified size limit.
   * Splits at the closest newline within the limit.
   * Each file gets its own front-matter.
   */
  private splitContentIntoFiles(
    rules: string,
    frontMatter: string,
    maxFileSize: number,
  ): string[] {
    const files: string[] = [];
    const availableSpace = maxFileSize - frontMatter.length;

    let remainingRules = rules;

    while (remainingRules.length > 0) {
      if (remainingRules.length <= availableSpace) {
        // Remaining content fits in one file
        files.push(`${frontMatter}${remainingRules}`);
        break;
      }

      // Find the last newline within the available space
      let splitIndex = availableSpace;
      const searchSpace = remainingRules.substring(0, availableSpace);
      const lastNewline = searchSpace.lastIndexOf('\n');

      if (lastNewline > 0) {
        // Split at the newline (include the newline in the current file)
        splitIndex = lastNewline + 1;
      } else {
        // No newline found within limit - split at the limit
        // This shouldn't happen often but we handle it gracefully
        splitIndex = availableSpace;
      }

      const chunk = remainingRules.substring(0, splitIndex);
      files.push(`${frontMatter}${chunk}`);

      remainingRules = remainingRules.substring(splitIndex);
    }

    return files;
  }
}
