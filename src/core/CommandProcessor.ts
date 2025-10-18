import * as path from 'path';
import { promises as fs } from 'fs';
import { CommandConfig } from '../types';
import { LoadedConfig } from './ConfigLoader';
import { createRulerError } from '../constants';

/**
 * Reads a command markdown file from the ruler directory.
 * @param rulerDir The .ruler directory path
 * @param promptFile Relative path to the command file
 * @param commandDir The command directory name (default: "commands")
 * @returns Promise resolving to the file content
 */
export async function readCommandFile(
  rulerDir: string,
  promptFile: string,
  commandDir = 'commands',
): Promise<string> {
  // If promptFile doesn't start with commandDir, prepend it
  const fullPromptFile = promptFile.startsWith(commandDir)
    ? promptFile
    : path.join(commandDir, promptFile);

  const absolutePath = path.resolve(rulerDir, fullPromptFile);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return content.trim();
  } catch {
    throw createRulerError(
      `Command file not found: ${fullPromptFile}`,
      `Expected at: ${absolutePath}`,
    );
  }
}

/**
 * Validates a command configuration.
 * @param config The command configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateCommandConfig(config: CommandConfig): void {
  if (!config.name || typeof config.name !== 'string') {
    throw createRulerError(
      'Command configuration missing required field: name',
      `Command config: ${JSON.stringify(config)}`,
    );
  }

  const hasPrompt = config.prompt && typeof config.prompt === 'string';
  const hasPromptFile =
    config.prompt_file && typeof config.prompt_file === 'string';

  if (!hasPrompt && !hasPromptFile) {
    throw createRulerError(
      "Command configuration must have either 'prompt' or 'prompt_file'",
      `Command config: ${JSON.stringify(config)}`,
    );
  }

  if (hasPrompt && hasPromptFile) {
    throw createRulerError(
      "Command configuration cannot have both 'prompt' and 'prompt_file'",
      `Command config: ${JSON.stringify(config)}`,
    );
  }

  if (
    !config.type ||
    !['slash', 'workflow', 'prompt-file', 'instruction'].includes(config.type)
  ) {
    throw createRulerError(
      'Command configuration has invalid type',
      `Expected one of: slash, workflow, prompt-file, instruction. Got: ${config.type}`,
    );
  }
}

/**
 * Extracts commands from the loaded configuration.
 * @param config The loaded configuration
 * @returns Record of command configurations
 */
export function getCommandsFromConfig(
  config: LoadedConfig,
): Record<string, CommandConfig> {
  const commands: Record<string, CommandConfig> = {};

  if (config.commands) {
    for (const [key, commandConfig] of Object.entries(config.commands)) {
      validateCommandConfig(commandConfig);
      commands[key] = commandConfig;
    }
  }

  return commands;
}

/**
 * Reads all command markdown files referenced in the configuration.
 * @param commands Command configurations
 * @param rulerDir The .ruler directory path
 * @param commandDir The command directory name (default: "commands")
 * @returns Promise resolving to command contents mapped by command key
 */
export async function readAllCommandFiles(
  commands: Record<string, CommandConfig>,
  rulerDir: string,
  commandDir = 'commands',
): Promise<Record<string, string>> {
  const commandContents: Record<string, string> = {};

  for (const [cmdKey, cmdConfig] of Object.entries(commands)) {
    try {
      // If inline prompt is provided, use it directly
      if (cmdConfig.prompt) {
        commandContents[cmdKey] = cmdConfig.prompt.trim();
      }
      // Otherwise, read from file
      else if (cmdConfig.prompt_file) {
        const content = await readCommandFile(
          rulerDir,
          cmdConfig.prompt_file,
          commandDir,
        );
        commandContents[cmdKey] = content;
      }
    } catch {
      // Log warning but continue - allow partial command processing
      console.warn(
        `[ruler] Warning: Could not read command file for ${cmdKey}: ${cmdConfig.prompt_file}`,
      );
      // Skip this command instead of failing entirely
    }
  }

  return commandContents;
}

/**
 * Gets the output paths for command files for a specific agent.
 * @param agentIdentifier The agent identifier
 * @param commands Command configurations
 * @param projectRoot The project root directory
 * @returns Array of output paths for .gitignore
 */
export function getCommandOutputPaths(
  agentIdentifier: string,
  commands: Record<string, CommandConfig>,
  _projectRoot: string, // eslint-disable-line @typescript-eslint/no-unused-vars
): string[] {
  const paths: string[] = [];

  // Define command directories for each agent
  const commandDirs: Record<string, string> = {
    claude: '.claude/commands',
    cursor: '.cursor/commands',
    codex: '.codex/prompts',
    augmentcode: '.augment/commands',
    windsurf: '.windsurf/workflows',
  };

  const commandDir = commandDirs[agentIdentifier];
  if (commandDir) {
    // Add the command directory itself
    paths.push(commandDir);

    // Add individual command files
    for (const cmdConfig of Object.values(commands)) {
      const commandPath = path.join(commandDir, `${cmdConfig.name}.md`);
      paths.push(commandPath);
    }
  }

  return paths;
}

/**
 * Removes all markdown files from a command directory.
 * @param commandDir The command directory path
 */
export async function cleanCommandDirectory(commandDir: string): Promise<void> {
  try {
    const files = await fs.readdir(commandDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        await fs.unlink(path.join(commandDir, file));
      }
    }
  } catch {
    // Directory doesn't exist or can't be read - that's fine
  }
}

/**
 * Shared implementation for applying commands to a specific directory.
 * This eliminates code duplication across agent implementations.
 * @param commands Command configurations from ruler.toml
 * @param commandContents Command markdown file contents
 * @param projectRoot The root directory of the project
 * @param commandDir The command directory path (e.g., '.claude/commands')
 * @param backup Whether to backup existing files
 */
export async function applyCommandsToDirectory(
  commands: Record<string, CommandConfig>,
  commandContents: Record<string, string>,
  projectRoot: string,
  commandDir: string,
  backup = true,
): Promise<void> {
  const { backupFile, writeGeneratedFile, ensureDirExists } = await import(
    './FileSystemUtils'
  );

  const commandsDir = path.join(projectRoot, commandDir);
  await ensureDirExists(commandsDir);

  // First, backup existing files if requested
  if (backup) {
    for (const [cmdKey, cmdConfig] of Object.entries(commands)) {
      const content = commandContents[cmdKey];
      if (!content) {
        // Skip commands that couldn't be read (missing files)
        continue;
      }
      const outputPath = path.join(commandsDir, `${cmdConfig.name}.md`);
      await backupFile(outputPath);
    }
  }

  // Then clean existing command files before regenerating
  await cleanCommandDirectory(commandsDir);

  // Finally, write new command files
  for (const [cmdKey, cmdConfig] of Object.entries(commands)) {
    const content = commandContents[cmdKey];
    if (!content) {
      // Skip commands that couldn't be read (missing files)
      continue;
    }
    const outputPath = path.join(commandsDir, `${cmdConfig.name}.md`);
    await writeGeneratedFile(outputPath, content);
  }
}
