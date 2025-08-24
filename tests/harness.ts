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
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-test-'));

  // Create files if provided
  if (files) {
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectRoot, relativePath);
      
      // Create parent directories if needed
      const parentDir = path.dirname(fullPath);
      await fs.mkdir(parentDir, { recursive: true });
      
      // Write file content
      await fs.writeFile(fullPath, content);
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
 * Executes a Ruler CLI command against a test project
 * @param command Command string (e.g., 'apply --agents copilot')
 * @param projectRoot Path to the test project directory
 * @returns Standard output from the command
 */
export function runRuler(command: string, projectRoot: string): string {
  const fullCommand = `node dist/cli/index.js ${command} --project-root ${projectRoot}`;
  return execSync(fullCommand, { 
    stdio: 'pipe',
    encoding: 'utf8'
  });
}

/**
 * Runs the CLI and returns combined stdout+stderr explicitly (useful when warnings may go to stderr).
 */
export function runRulerAll(command: string, projectRoot: string): string {
  // NOTE: execSync only returns stdout. console.warn writes to stderr.
  // We redirect stderr (2) to stdout (1) so legacy warnings emitted via console.warn are captured.
  const fullCommand = `node dist/cli/index.js ${command} --project-root ${projectRoot} 2>&1`;
  return execSync(fullCommand, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
}

/**
 * Executes a Ruler CLI command against a test project with inherited stdio
 * @param command Command string (e.g., 'apply --agents copilot')
 * @param projectRoot Path to the test project directory
 */
export function runRulerWithInheritedStdio(command: string, projectRoot: string): void {
  const fullCommand = `node dist/cli/index.js ${command} --project-root ${projectRoot}`;
  execSync(fullCommand, { stdio: 'inherit' });
}