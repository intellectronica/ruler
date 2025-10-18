import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import {
  readCommandFile,
  validateCommandConfig,
  getCommandsFromConfig,
  readAllCommandFiles,
  getCommandOutputPaths,
  cleanCommandDirectory,
} from '../../../src/core/CommandProcessor';
import { CommandConfig } from '../../../src/types';
import { LoadedConfig } from '../../../src/core/ConfigLoader';

describe('CommandProcessor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('readCommandFile', () => {
    it('should read a command file successfully', async () => {
      const rulerDir = path.join(tempDir, '.ruler');
      const commandsDir = path.join(rulerDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const commandContent = '# PR Review\nReview this PR for best practices.';
      await fs.writeFile(
        path.join(commandsDir, 'pr-review.md'),
        commandContent,
      );

      const result = await readCommandFile(rulerDir, 'commands/pr-review.md');
      expect(result).toBe(commandContent);
    });

    it('should throw error when command file does not exist', async () => {
      const rulerDir = path.join(tempDir, '.ruler');
      await fs.mkdir(rulerDir, { recursive: true });

      await expect(
        readCommandFile(rulerDir, 'commands/nonexistent.md'),
      ).rejects.toThrow('Command file not found');
    });

    it('should trim whitespace from command content', async () => {
      const rulerDir = path.join(tempDir, '.ruler');
      const commandsDir = path.join(rulerDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const commandContent = '  \n\n# PR Review\nReview this PR.\n\n  ';
      await fs.writeFile(
        path.join(commandsDir, 'pr-review.md'),
        commandContent,
      );

      const result = await readCommandFile(rulerDir, 'commands/pr-review.md');
      expect(result).toBe('# PR Review\nReview this PR.');
    });
  });

  describe('validateCommandConfig', () => {
    it('should validate a correct command config', () => {
      const config: CommandConfig = {
        name: 'review_code',
        description: 'Review code for best practices',
        prompt_file: 'commands/pr-review.md',
        type: 'slash',
      };

      expect(() => validateCommandConfig(config)).not.toThrow();
    });

    it('should throw error for missing name', () => {
      const config = {
        description: 'Review code',
        prompt_file: 'commands/pr-review.md',
        type: 'slash',
      } as CommandConfig;

      expect(() => validateCommandConfig(config)).toThrow(
        'Command configuration missing required field: name',
      );
    });

    it('should throw error for missing prompt_file', () => {
      const config = {
        name: 'review_code',
        description: 'Review code',
        type: 'slash',
      } as unknown as CommandConfig;

      expect(() => validateCommandConfig(config)).toThrow(
        'Command configuration missing required field: prompt_file',
      );
    });

    it('should throw error for invalid type', () => {
      const config = {
        name: 'review_code',
        description: 'Review code',
        prompt_file: 'commands/pr-review.md',
        type: 'invalid',
      } as unknown as CommandConfig;

      expect(() => validateCommandConfig(config)).toThrow(
        'Command configuration has invalid type',
      );
    });
  });

  describe('getCommandsFromConfig', () => {
    it('should extract commands from config', () => {
      const config: LoadedConfig = {
        agentConfigs: {},
        commands: {
          review_code: {
            name: 'review_code',
            description: 'Review code',
            prompt_file: 'commands/pr-review.md',
            type: 'slash',
          },
          generate_tests: {
            name: 'generate_tests',
            description: 'Generate tests',
            prompt_file: 'commands/test-gen.md',
            type: 'prompt-file',
          },
        },
      };

      const commands = getCommandsFromConfig(config);
      expect(Object.keys(commands)).toHaveLength(2);
      expect(commands.review_code.name).toBe('review_code');
      expect(commands.generate_tests.name).toBe('generate_tests');
    });

    it('should return empty object when no commands defined', () => {
      const config: LoadedConfig = {
        agentConfigs: {},
      };

      const commands = getCommandsFromConfig(config);
      expect(commands).toEqual({});
    });

    it('should throw error for invalid command config', () => {
      const config: LoadedConfig = {
        agentConfigs: {},
        commands: {
          invalid: {
            description: 'Missing name',
            prompt_file: 'commands/test.md',
            type: 'slash',
          } as CommandConfig,
        },
      };

      expect(() => getCommandsFromConfig(config)).toThrow(
        'Command configuration missing required field: name',
      );
    });
  });

  describe('readAllCommandFiles', () => {
    it('should read all command files', async () => {
      const rulerDir = path.join(tempDir, '.ruler');
      const commandsDir = path.join(rulerDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      await fs.writeFile(
        path.join(commandsDir, 'pr-review.md'),
        'Review this PR',
      );
      await fs.writeFile(
        path.join(commandsDir, 'test-gen.md'),
        'Generate tests',
      );

      const commands = {
        review: {
          name: 'review',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'slash' as const,
        },
        test: {
          name: 'test',
          description: 'Generate tests',
          prompt_file: 'commands/test-gen.md',
          type: 'prompt-file' as const,
        },
      };

      const contents = await readAllCommandFiles(commands, rulerDir);
      expect(contents.review).toBe('Review this PR');
      expect(contents.test).toBe('Generate tests');
    });

    it('should handle missing command files gracefully', async () => {
      const rulerDir = path.join(tempDir, '.ruler');
      await fs.mkdir(rulerDir, { recursive: true });

      const commands = {
        review: {
          name: 'review',
          description: 'Review code',
          prompt_file: 'commands/nonexistent.md',
          type: 'slash' as const,
        },
      };

      // Should not throw error, but return empty object for missing files
      const result = await readAllCommandFiles(commands, rulerDir);
      expect(result).toEqual({});
    });
  });

  describe('getCommandOutputPaths', () => {
    it('should return command paths for claude agent', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'slash' as const,
        },
      };

      const paths = getCommandOutputPaths('claude', commands, '/project');
      expect(paths).toContain('.claude/commands');
      expect(paths).toContain('.claude/commands/review_code.md');
    });

    it('should return command paths for cursor agent', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'slash' as const,
        },
      };

      const paths = getCommandOutputPaths('cursor', commands, '/project');
      expect(paths).toContain('.cursor/commands');
      expect(paths).toContain('.cursor/commands/review_code.md');
    });

    it('should return command paths for codex agent', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'prompt-file' as const,
        },
      };

      const paths = getCommandOutputPaths('codex', commands, '/project');
      expect(paths).toContain('.codex/prompts');
      expect(paths).toContain('.codex/prompts/review_code.md');
    });

    it('should return command paths for augmentcode agent', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'slash' as const,
        },
      };

      const paths = getCommandOutputPaths('augmentcode', commands, '/project');
      expect(paths).toContain('.augment/commands');
      expect(paths).toContain('.augment/commands/review_code.md');
    });

    it('should return command paths for windsurf agent', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'workflow' as const,
        },
      };

      const paths = getCommandOutputPaths('windsurf', commands, '/project');
      expect(paths).toContain('.windsurf/workflows');
      expect(paths).toContain('.windsurf/workflows/review_code.md');
    });

    it('should return empty array for unsupported agent', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'slash' as const,
        },
      };

      const paths = getCommandOutputPaths('unknown', commands, '/project');
      expect(paths).toEqual([]);
    });

    it('should return paths for multiple commands', () => {
      const commands = {
        review: {
          name: 'review_code',
          description: 'Review code',
          prompt_file: 'commands/pr-review.md',
          type: 'slash' as const,
        },
        test: {
          name: 'generate_tests',
          description: 'Generate tests',
          prompt_file: 'commands/test-gen.md',
          type: 'slash' as const,
        },
      };

      const paths = getCommandOutputPaths('claude', commands, '/project');
      expect(paths).toContain('.claude/commands');
      expect(paths).toContain('.claude/commands/review_code.md');
      expect(paths).toContain('.claude/commands/generate_tests.md');
    });
  });

  describe('cleanCommandDirectory', () => {
    it('should remove all markdown files from directory', async () => {
      const testDir = path.join(tempDir, 'test-commands');
      await fs.mkdir(testDir, { recursive: true });

      // Create some test files
      await fs.writeFile(path.join(testDir, 'command1.md'), 'Content 1');
      await fs.writeFile(path.join(testDir, 'command2.md'), 'Content 2');
      await fs.writeFile(path.join(testDir, 'config.json'), '{"test": true}'); // Non-md file

      // Verify files exist
      const filesBefore = await fs.readdir(testDir);
      expect(filesBefore).toHaveLength(3);

      // Clean the directory
      await cleanCommandDirectory(testDir);

      // Verify only non-md files remain
      const filesAfter = await fs.readdir(testDir);
      expect(filesAfter).toEqual(['config.json']);
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent');

      // Should not throw error
      await expect(
        cleanCommandDirectory(nonExistentDir),
      ).resolves.toBeUndefined();
    });

    it('should handle empty directory gracefully', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.mkdir(emptyDir, { recursive: true });

      // Should not throw error
      await expect(cleanCommandDirectory(emptyDir)).resolves.toBeUndefined();
    });
  });
});
