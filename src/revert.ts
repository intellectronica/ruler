import { promises as fs } from 'fs';
import * as FileSystemUtils from './core/FileSystemUtils';
import { loadConfig } from './core/ConfigLoader';
import { IAgent } from './agents/IAgent';
import { allAgents } from './agents';
import { createRulerError, logVerbose, actionPrefix } from './constants';
import {
  revertAgentConfiguration,
  cleanUpAuxiliaryFiles,
  cleanUpAgentDirectories,
} from './core/revert-engine';
import {
  agentMatchesFilter,
  resolveSelectedAgents,
} from './core/agent-selection';
import { mapRawAgentConfigs } from './core/config-utils';
import { resolveIgnoreFilePath } from './core/GitignoreUtils';

const agents: IAgent[] = allAgents;
const RULER_IGNORE_START_MARKER = '# START Ruler Generated Files';
const RULER_IGNORE_END_MARKER = '# END Ruler Generated Files';
const MANAGED_IGNORE_FILES = ['.gitignore', '.git/info/exclude'];

export { allAgents };

/**
 * Reverts ruler configurations for selected AI agents.
 */
export async function revertAllAgentConfigs(
  projectRoot: string,
  includedAgents?: string[],
  configPath?: string,
  keepBackups = false,
  verbose = false,
  dryRun = false,
  localOnly = false,
): Promise<void> {
  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot, !localOnly);
  if (!rulerDir) {
    throw createRulerError(
      `.ruler directory not found`,
      `Searched from: ${projectRoot}`,
    );
  }
  const effectiveProjectRoot = FileSystemUtils.resolveProjectRootForRulerDir(
    projectRoot,
    rulerDir,
  );

  logVerbose(
    `Loading configuration for revert from project root: ${effectiveProjectRoot}`,
    verbose,
  );

  const config = await loadConfig({
    projectRoot: effectiveProjectRoot,
    cliAgents: includedAgents,
    configPath,
    checkGlobal: !localOnly,
  });

  logVerbose(`Found .ruler directory at: ${rulerDir}`, verbose);

  // Normalize per-agent config keys to agent identifiers
  config.agentConfigs = mapRawAgentConfigs(config.agentConfigs, agents);

  // Select agents to revert (same logic as apply, but with backward compatibility for invalid agents)
  let selected: IAgent[];
  try {
    selected = resolveSelectedAgents(config, agents);
  } catch (error) {
    // For backward compatibility, revert continues with available agents if some are invalid
    // This preserves the original behavior where invalid agents were silently ignored
    if (
      error instanceof Error &&
      error.message.includes('Invalid agent specified')
    ) {
      logVerbose(
        `Warning: ${error.message} - continuing with valid agents only`,
        verbose,
      );

      // Fall back to the old logic without validation
      if (config.cliAgents && config.cliAgents.length > 0) {
        const filters = config.cliAgents.map((n) => n.toLowerCase());
        const validAgentIdentifiers = new Set(
          agents.map((agent) => agent.getIdentifier()),
        );
        selected = agents.filter((agent) =>
          filters.some((f) =>
            agentMatchesFilter(agent, f, validAgentIdentifiers),
          ),
        );
      } else if (config.defaultAgents && config.defaultAgents.length > 0) {
        const defaults = config.defaultAgents.map((n) => n.toLowerCase());
        const validAgentIdentifiers = new Set(
          agents.map((agent) => agent.getIdentifier()),
        );
        selected = agents.filter((agent) => {
          const identifier = agent.getIdentifier();
          const override = config.agentConfigs[identifier]?.enabled;
          if (override !== undefined) {
            return override;
          }
          return defaults.some((d) =>
            agentMatchesFilter(agent, d, validAgentIdentifiers),
          );
        });
      } else {
        selected = agents.filter(
          (agent) =>
            config.agentConfigs[agent.getIdentifier()]?.enabled !== false,
        );
      }
    } else {
      throw error;
    }
  }

  logVerbose(
    `Selected agents: ${selected.map((a) => a.getName()).join(', ')}`,
    verbose,
  );
  const isFullRevert = !config.cliAgents || config.cliAgents.length === 0;

  // Revert configurations for each agent
  let totalFilesProcessed = 0;
  let totalFilesRestored = 0;
  let totalFilesRemoved = 0;
  let totalBackupsRemoved = 0;
  let totalDirectoriesRemoved = 0;

  for (const agent of selected) {
    const prefix = actionPrefix(dryRun);
    console.log(`${prefix} Reverting ${agent.getName()}...`);

    const agentConfig = config.agentConfigs[agent.getIdentifier()];
    const result = await revertAgentConfiguration(
      agent,
      effectiveProjectRoot,
      agentConfig,
      keepBackups,
      verbose,
      dryRun,
    );

    totalFilesProcessed += result.restored + result.removed;
    totalFilesRestored += result.restored;
    totalFilesRemoved += result.removed;
    totalBackupsRemoved += result.backupsRemoved;

    if (!isFullRevert) {
      totalDirectoriesRemoved += await cleanUpAgentDirectories(
        agent,
        effectiveProjectRoot,
        agentConfig,
        verbose,
        dryRun,
      );
    }
  }

  // Clean up auxiliary files and directories only when reverting all agents.
  const cleanupResult = isFullRevert
    ? await cleanUpAuxiliaryFiles(effectiveProjectRoot, verbose, dryRun)
    : { additionalFilesRemoved: 0, directoriesRemoved: 0 };
  totalFilesRemoved += cleanupResult.additionalFilesRemoved;
  totalDirectoriesRemoved += cleanupResult.directoriesRemoved;

  // Clean managed ignore blocks if reverting all agents.
  const cleanedIgnoreFiles = isFullRevert
    ? await cleanManagedIgnoreFiles(effectiveProjectRoot, verbose, dryRun)
    : [];

  // Display summary
  const prefix = actionPrefix(dryRun);

  if (dryRun) {
    console.log(`${prefix} Revert summary (dry run):`);
  } else {
    console.log(`${prefix} Revert completed successfully.`);
  }

  console.log(`  Files processed: ${totalFilesProcessed}`);
  console.log(`  Files restored from backup: ${totalFilesRestored}`);
  console.log(`  Generated files removed: ${totalFilesRemoved}`);
  console.log(`  Backup files removed: ${totalBackupsRemoved}`);
  if (totalDirectoriesRemoved > 0) {
    console.log(`  Empty directories removed: ${totalDirectoriesRemoved}`);
  }
  for (const ignoreFile of cleanedIgnoreFiles) {
    console.log(`  ${ignoreFile} cleaned: yes`);
  }
}

/**
 * Removes the ruler-managed block from ignore files Ruler can update.
 */
async function cleanManagedIgnoreFiles(
  projectRoot: string,
  verbose: boolean,
  dryRun: boolean,
): Promise<string[]> {
  const cleanedFiles: string[] = [];

  for (const ignoreFile of MANAGED_IGNORE_FILES) {
    if (await cleanIgnoreFile(projectRoot, ignoreFile, verbose, dryRun)) {
      cleanedFiles.push(ignoreFile);
    }
  }

  return cleanedFiles;
}

async function cleanIgnoreFile(
  projectRoot: string,
  ignoreFile: string,
  verbose: boolean,
  dryRun: boolean,
): Promise<boolean> {
  const ignorePath = await resolveIgnoreFilePath(projectRoot, ignoreFile);

  try {
    await fs.access(ignorePath);
  } catch {
    logVerbose(`No ${ignoreFile} file found`, verbose);
    return false;
  }

  const content = await fs.readFile(ignorePath, 'utf8');

  const startIndex = content.indexOf(RULER_IGNORE_START_MARKER);
  if (startIndex === -1) {
    logVerbose(`No ruler-managed block found in ${ignoreFile}`, verbose);
    return false;
  }

  const endIndex = content.indexOf(
    RULER_IGNORE_END_MARKER,
    startIndex + RULER_IGNORE_START_MARKER.length,
  );

  if (endIndex === -1) {
    logVerbose(`No ruler-managed block found in ${ignoreFile}`, verbose);
    return false;
  }

  const prefix = actionPrefix(dryRun);

  if (dryRun) {
    logVerbose(
      `${prefix} Would remove ruler block from ${ignoreFile}`,
      verbose,
    );
  } else {
    const beforeBlock = content.substring(0, startIndex);
    const afterBlock = content.substring(
      endIndex + RULER_IGNORE_END_MARKER.length,
    );

    let newContent = beforeBlock + afterBlock;
    newContent = newContent.replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with 2

    if (newContent.trim() === '') {
      await fs.unlink(ignorePath);
      logVerbose(`${prefix} Removed empty ${ignoreFile} file`, verbose);
    } else {
      await fs.writeFile(ignorePath, newContent);
      logVerbose(`${prefix} Removed ruler block from ${ignoreFile}`, verbose);
    }
  }

  return true;
}
