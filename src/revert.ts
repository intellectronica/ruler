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
import { resolveSelectedAgents } from './core/agent-selection';
import { mapRawAgentConfigs } from './core/config-utils';
import {
  removeCompleteRulerBlocks,
  resolveIgnoreFileTarget,
} from './core/GitignoreUtils';

const agents: IAgent[] = allAgents;
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

  // Select agents to revert using the same validation semantics as apply.
  const selected = resolveSelectedAgents(config, agents);

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
  const processedPaths = new Set<string>();

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
      processedPaths,
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
  const ignoreTarget = await resolveIgnoreFileTarget(projectRoot, ignoreFile);
  const ignorePath = ignoreTarget.path;

  try {
    await fs.access(ignorePath);
  } catch {
    logVerbose(`No ${ignoreFile} file found`, verbose);
    return false;
  }

  await FileSystemUtils.assertManagedPathInsideRoot(
    ignorePath,
    ignoreTarget.containmentRoot,
    `Refusing to clean ${ignoreFile} through symlinked path`,
  );
  await FileSystemUtils.assertNotSymbolicLink(
    ignorePath,
    `Refusing to clean symlinked ${ignoreFile}`,
  );
  await FileSystemUtils.assertNotHardLinked(
    ignorePath,
    `Refusing to clean hard-linked ${ignoreFile}`,
  );

  const content = await fs.readFile(ignorePath, 'utf8');
  const cleaned = removeCompleteRulerBlocks(content);
  if (!cleaned.removed) {
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
    if (cleaned.content.trim() === '') {
      await fs.unlink(ignorePath);
      logVerbose(`${prefix} Removed empty ${ignoreFile} file`, verbose);
    } else {
      await fs.writeFile(ignorePath, cleaned.content);
      logVerbose(`${prefix} Removed ruler block from ${ignoreFile}`, verbose);
    }
  }

  return true;
}
