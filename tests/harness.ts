import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface TestProject {
  projectRoot: string;
}

/**
 * Creates a temporary test project with optional files
 * @param files Optional object where keys are relative file paths and values are file contents
 * @returns Object containing the projectRoot path
 */
export async function setupTestProject(files?: Record<string, string>): Promise<TestProject> {
  // Create unique temporary directory
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skiller-test-'));

  // Track .claude directories created so we can ensure skiller.toml exists
  const claudeDirs = new Set<string>();

  // Create files if provided
  if (files) {
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectRoot, relativePath);

      // Create parent directories if needed
      const parentDir = path.dirname(fullPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Track if we created a .claude directory
      const pathParts = relativePath.split('/');
      const claudeIndex = pathParts.indexOf('.claude');
      if (claudeIndex !== -1) {
        const claudeRelPath = pathParts.slice(0, claudeIndex + 1).join('/');
        claudeDirs.add(path.join(projectRoot, claudeRelPath));
      }

      // Write file content
      await fs.writeFile(fullPath, content);
    }
  }

  // Ensure skiller.toml exists in each .claude directory
  for (const claudeDir of claudeDirs) {
    const tomlPath = path.join(claudeDir, 'skiller.toml');
    try {
      await fs.access(tomlPath);
    } catch {
      // Create empty skiller.toml if it doesn't exist
      await fs.writeFile(tomlPath, '');
    }
  }

  return { projectRoot };
}

/**
 * Removes a temporary test project directory
 * @param projectRoot Path to the temporary project directory to remove
 */
export async function teardownTestProject(projectRoot: string): Promise<void> {
  await fs.rm(projectRoot, { recursive: true, force: true });
}

/**
 * Executes a Skiller CLI command against a test project
 * @param command Command string (e.g., 'apply --agents copilot')
 * @param projectRoot Path to the test project directory
 * @returns Standard output from the command
 */
export function runSkiller(command: string, projectRoot: string): string {
  const fullCommand = `node dist/cli/index.js ${command} --project-root ${projectRoot}`;
  return execSync(fullCommand, { 
    stdio: 'pipe',
    encoding: 'utf8'
  });
}

/**
 * Runs the CLI and returns combined stdout+stderr explicitly (useful when warnings may go to stderr).
 */
export function runSkillerAll(command: string, projectRoot: string): string {
  // NOTE: execSync only returns stdout. console.warn writes to stderr.
  // We redirect stderr (2) to stdout (1) so legacy warnings emitted via console.warn are captured.
  const fullCommand = `node dist/cli/index.js ${command} --project-root ${projectRoot} 2>&1`;
  return execSync(fullCommand, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
}

/**
 * Executes a Skiller CLI command against a test project with inherited stdio
 * @param command Command string (e.g., 'apply --agents copilot')
 * @param projectRoot Path to the test project directory
 */
export function runSkillerWithInheritedStdio(command: string, projectRoot: string): void {
  const fullCommand = `node dist/cli/index.js ${command} --project-root ${projectRoot}`;
  execSync(fullCommand, { stdio: 'inherit' });
}