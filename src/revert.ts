import * as path from 'path';
import { promises as fs } from 'fs';
import * as FileSystemUtils from './core/FileSystemUtils';
import { loadConfig } from './core/ConfigLoader';
import { IAgent } from './agents/IAgent';
import { CopilotAgent } from './agents/CopilotAgent';
import { ClaudeAgent } from './agents/ClaudeAgent';
import { CodexCliAgent } from './agents/CodexCliAgent';
import { CursorAgent } from './agents/CursorAgent';
import { WindsurfAgent } from './agents/WindsurfAgent';
import * as ClineAgent from './agents/ClineAgent';
import { AiderAgent } from './agents/AiderAgent';
import { FirebaseAgent } from './agents/FirebaseAgent';
import { OpenHandsAgent } from './agents/OpenHandsAgent';
import { GeminiCliAgent } from './agents/GeminiCliAgent';
import { JulesAgent } from './agents/JulesAgent';
import { JunieAgent } from './agents/JunieAgent';
import { AugmentCodeAgent } from './agents/AugmentCodeAgent';
import { KiloCodeAgent } from './agents/KiloCodeAgent';
import { OpenCodeAgent } from './agents/OpenCodeAgent';
import { GooseAgent } from './agents/GooseAgent';
import { AmpAgent } from './agents/AmpAgent';
import { createRulerError, logVerbose } from './constants';
import {
  revertAgentConfiguration,
  cleanUpAuxiliaryFiles,
} from './core/revert-engine';

const agents: IAgent[] = [
  new CopilotAgent(),
  new ClaudeAgent(),
  new CodexCliAgent(),
  new CursorAgent(),
  new WindsurfAgent(),
  new ClineAgent.ClineAgent(),
  new AiderAgent(),
  new FirebaseAgent(),
  new OpenHandsAgent(),
  new GeminiCliAgent(),
  new JulesAgent(),
  new JunieAgent(),
  new AugmentCodeAgent(),
  new KiloCodeAgent(),
  new OpenCodeAgent(),
  new GooseAgent(),
  new AmpAgent(),
];



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
  logVerbose(
    `Loading configuration for revert from project root: ${projectRoot}`,
    verbose,
  );

  const config = await loadConfig({
    projectRoot,
    cliAgents: includedAgents,
    configPath,
  });

  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot, !localOnly);
  if (!rulerDir) {
    throw createRulerError(
      `.ruler directory not found`,
      `Searched from: ${projectRoot}`,
    );
  }
  logVerbose(`Found .ruler directory at: ${rulerDir}`, verbose);

  // Normalize per-agent config keys to agent identifiers
  const rawConfigs = config.agentConfigs;
  const mappedConfigs: Record<string, (typeof rawConfigs)[string]> = {};
  for (const [key, cfg] of Object.entries(rawConfigs)) {
    const lowerKey = key.toLowerCase();
    for (const agent of agents) {
      const identifier = agent.getIdentifier();
      if (
        identifier === lowerKey ||
        agent.getName().toLowerCase().includes(lowerKey)
      ) {
        mappedConfigs[identifier] = cfg;
      }
    }
  }
  config.agentConfigs = mappedConfigs;

  // Select agents to revert (same logic as apply)
  let selected = agents;
  if (config.cliAgents && config.cliAgents.length > 0) {
    const filters = config.cliAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) =>
      filters.some(
        (f) =>
          agent.getIdentifier() === f ||
          agent.getName().toLowerCase().includes(f),
      ),
    );
    logVerbose(
      `Selected agents via CLI filter: ${selected.map((a) => a.getName()).join(', ')}`,
      verbose,
    );
  } else if (config.defaultAgents && config.defaultAgents.length > 0) {
    const defaults = config.defaultAgents.map((n) => n.toLowerCase());
    selected = agents.filter((agent) => {
      const identifier = agent.getIdentifier();
      const override = config.agentConfigs[identifier]?.enabled;
      if (override !== undefined) {
        return override;
      }
      return defaults.some(
        (d) => identifier === d || agent.getName().toLowerCase().includes(d),
      );
    });
    logVerbose(
      `Selected agents via config default_agents: ${selected.map((a) => a.getName()).join(', ')}`,
      verbose,
    );
  } else {
    selected = agents.filter(
      (agent) => config.agentConfigs[agent.getIdentifier()]?.enabled !== false,
    );
    logVerbose(
      `Selected all enabled agents: ${selected.map((a) => a.getName()).join(', ')}`,
      verbose,
    );
  }

  // Revert configurations for each agent
  let totalFilesProcessed = 0;
  let totalFilesRestored = 0;
  let totalFilesRemoved = 0;
  let totalBackupsRemoved = 0;

  for (const agent of selected) {
    const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';
    console.log(`${actionPrefix} Reverting ${agent.getName()}...`);

    const agentConfig = config.agentConfigs[agent.getIdentifier()];
    const result = await revertAgentConfiguration(
      agent,
      projectRoot,
      agentConfig,
      keepBackups,
      verbose,
      dryRun,
    );

    totalFilesProcessed += result.restored + result.removed;
    totalFilesRestored += result.restored;
    totalFilesRemoved += result.removed;
    totalBackupsRemoved += result.backupsRemoved;
  }

  // Clean up auxiliary files and directories
  const cleanupResult = await cleanUpAuxiliaryFiles(
    projectRoot,
    verbose,
    dryRun,
  );
  totalFilesRemoved += cleanupResult.additionalFilesRemoved;

  // Clean .gitignore if reverting all agents
  const gitignoreCleaned =
    !config.cliAgents || config.cliAgents.length === 0
      ? await cleanGitignore(projectRoot, verbose, dryRun)
      : false;

  // Display summary
  const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';

  if (dryRun) {
    console.log(`${actionPrefix} Revert summary (dry run):`);
  } else {
    console.log(`${actionPrefix} Revert completed successfully.`);
  }

  console.log(`  Files processed: ${totalFilesProcessed}`);
  console.log(`  Files restored from backup: ${totalFilesRestored}`);
  console.log(`  Generated files removed: ${totalFilesRemoved}`);
  if (!keepBackups) {
    console.log(`  Backup files removed: ${totalBackupsRemoved}`);
  }
  if (cleanupResult.directoriesRemoved > 0) {
    console.log(`  Empty directories removed: ${cleanupResult.directoriesRemoved}`);
  }
  if (gitignoreCleaned) {
    console.log(`  .gitignore cleaned: yes`);
  }
}

/**
 * Removes the ruler-managed block from .gitignore file.
 */
async function cleanGitignore(
  projectRoot: string,
  verbose: boolean,
  dryRun: boolean,
): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  
  try {
    await fs.access(gitignorePath);
  } catch {
    logVerbose('No .gitignore file found', verbose);
    return false;
  }

  const content = await fs.readFile(gitignorePath, 'utf8');
  const startMarker = '# START Ruler Generated Files';
  const endMarker = '# END Ruler Generated Files';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    logVerbose('No ruler-managed block found in .gitignore', verbose);
    return false;
  }

  const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';

  if (dryRun) {
    logVerbose(
      `${actionPrefix} Would remove ruler block from .gitignore`,
      verbose,
    );
  } else {
    const beforeBlock = content.substring(0, startIndex);
    const afterBlock = content.substring(endIndex + endMarker.length);

    let newContent = beforeBlock + afterBlock;
    newContent = newContent.replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with 2

    if (newContent.trim() === '') {
      await fs.unlink(gitignorePath);
      logVerbose(`${actionPrefix} Removed empty .gitignore file`, verbose);
    } else {
      await fs.writeFile(gitignorePath, newContent);
      logVerbose(
        `${actionPrefix} Removed ruler block from .gitignore`,
        verbose,
      );
    }
  }

  return true;
}
