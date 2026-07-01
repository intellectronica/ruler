import * as path from 'path';
import * as fs from 'fs/promises';
import type { FoldersConfig } from '../types';
import type { IAgent } from '../agents/IAgent';
import { assertManagedPathInsideRoot } from './FileSystemUtils';
import { logWarn, logVerboseInfo } from '../constants';

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(src: string, dest: string): Promise<void> {
  const stat = await fs.lstat(src);

  if (stat.isSymbolicLink()) {
    return;
  }

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      await copyRecursive(srcPath, destPath);
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

async function removeDirectory(
  targetPath: string,
  projectRoot: string,
): Promise<void> {
  await assertManagedPathInsideRoot(
    targetPath,
    projectRoot,
    'Refusing to remove folder through symlinked path',
  );
  await fs.rm(targetPath, { recursive: true, force: true });
}

/**
 * Collects all source folder names that are configured for propagation
 * across all agents in the folders config. Used to determine which
 * subdirectories to skip during rule concatenation.
 */
export function getFolderSkipDirectories(folders?: FoldersConfig): string[] {
  if (!folders?.enabled || !folders.agents) {
    return [];
  }
  const seen = new Set<string>();
  for (const mappings of Object.values(folders.agents)) {
    for (const source of Object.keys(mappings)) {
      seen.add(source);
    }
  }
  return Array.from(seen);
}

/**
 * Returns whether `skip_unmapped` is enabled in the folders config.
 */
export function getFolderSkipUnmapped(folders?: FoldersConfig): boolean {
  return folders?.enabled === true && folders?.skip_unmapped === true;
}

/**
 * Propagates configured folders from `.ruler/<source>/` to each agent's
 * target path.
 *
 * When folders are disabled, previously propagated folders are cleaned up
 * (removed) based on the agent mappings in the config.
 */
export async function propagateFolders(
  projectRoot: string,
  agents: IAgent[],
  folders: FoldersConfig | undefined,
  verbose: boolean,
  dryRun: boolean,
): Promise<{ generatedPaths: string[] }> {
  const generatedPaths: string[] = [];

  if (!folders?.enabled || !folders.agents) {
    // Clean up previously propagated folders when disabled
    if (folders && Object.keys(folders.agents ?? {}).length > 0) {
      logVerboseInfo(
        'Folders support disabled, cleaning up propagated directories',
        verbose,
        dryRun,
      );
      await cleanupFolderTargets(projectRoot, folders, verbose, dryRun);
    } else {
      logVerboseInfo(
        'Folders support disabled or no folder mappings configured',
        verbose,
        dryRun,
      );
    }
    return { generatedPaths };
  }

  const rulerDir = path.join(projectRoot, '.ruler');
  const rulerDirExists = await dirExists(rulerDir);
  if (!rulerDirExists) {
    logVerboseInfo(
      'No .ruler directory found, skipping folder propagation',
      verbose,
      dryRun,
    );
    return { generatedPaths };
  }

  // Collect target paths from all agents for gitignore
  for (const [agentId, mappings] of Object.entries(folders.agents)) {
    // Check if this agent is in the selected agents list
    const isAgentSelected = agents.some(
      (a) => a.getIdentifier() === agentId,
    );
    if (!isAgentSelected) {
      continue;
    }

    for (const [source, target] of Object.entries(mappings)) {
      const sourcePath = path.join(rulerDir, source);
      const targetPath = path.resolve(projectRoot, target);

      if (!(await dirExists(sourcePath))) {
        logVerboseInfo(
          `Source folder .ruler/${source} not found for agent ${agentId}, skipping`,
          verbose,
          dryRun,
        );
        continue;
      }

      // Track for gitignore (use relative path from project root)
      const relativeTarget = path.relative(projectRoot, targetPath);
      const normalizedTarget = relativeTarget.replace(/\\/g, '/');
      if (!generatedPaths.includes(normalizedTarget)) {
        generatedPaths.push(normalizedTarget);
      }

      if (dryRun) {
        logVerboseInfo(
          `DRY RUN: Would copy .ruler/${source}/ → ${normalizedTarget}/ for ${agentId}`,
          verbose,
          dryRun,
        );
      } else {
        await assertManagedPathInsideRoot(
          targetPath,
          projectRoot,
          `Refusing to write folder for ${agentId} outside project`,
        );

        // Remove existing target if it exists
        try {
          await removeDirectory(targetPath, projectRoot);
        } catch {
          // Target didn't exist, that's fine
        }

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        // Recursively copy source → target
        await copyRecursive(sourcePath, targetPath);

        logVerboseInfo(
          `Copied .ruler/${source}/ → ${normalizedTarget}/ for ${agentId}`,
          verbose,
          dryRun,
        );
      }
    }
  }

  return { generatedPaths };
}

async function cleanupFolderTargets(
  projectRoot: string,
  folders: FoldersConfig,
  verbose: boolean,
  dryRun: boolean,
): Promise<void> {
  if (!folders.agents) return;

  for (const mappings of Object.values(folders.agents)) {
    for (const target of Object.values(mappings)) {
      const targetPath = path.resolve(projectRoot, target);
      const relativeTarget = path.relative(projectRoot, targetPath);

      if (await dirExists(targetPath)) {
        if (dryRun) {
          logVerboseInfo(
            `DRY RUN: Would remove ${relativeTarget}/`,
            verbose,
            dryRun,
          );
        } else {
          try {
            await removeDirectory(targetPath, projectRoot);
            logVerboseInfo(
              `Removed ${relativeTarget}/ (folders disabled)`,
              verbose,
              dryRun,
            );
          } catch (err) {
            logWarn(
              `Failed to remove ${relativeTarget}/: ${(err as Error).message}`,
              dryRun,
            );
          }
        }
      }
    }
  }
}

/**
 * Returns absolute paths that folder propagation may generate, for gitignore
 * integration.
 */
export async function getFoldersGitignorePaths(
  projectRoot: string,
  agents: IAgent[],
  folders: FoldersConfig | undefined,
): Promise<string[]> {
  if (!folders?.enabled || !folders.agents) {
    return [];
  }

  const paths: string[] = [];

  for (const [agentId, mappings] of Object.entries(folders.agents)) {
    const isAgentSelected = agents.some(
      (a) => a.getIdentifier() === agentId,
    );
    if (!isAgentSelected) {
      continue;
    }

    for (const target of Object.values(mappings)) {
      const resolved = path.resolve(projectRoot, target);
      const relative = path.relative(projectRoot, resolved);
      paths.push(relative.replace(/\\/g, '/'));
    }
  }

  return paths;
}
