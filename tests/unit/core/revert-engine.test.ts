import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import {
  revertAgentConfiguration,
  cleanUpAuxiliaryFiles,
} from '../../../src/core/revert-engine';
import { IAgent } from '../../../src/agents/IAgent';
import { IAgentConfig } from '../../../src/core/ConfigLoader';

// Mock agent for testing
class MockAgent implements IAgent {
  constructor(
    private name: string,
    private identifier: string,
  ) {}

  getName(): string {
    return this.name;
  }

  getIdentifier(): string {
    return this.identifier;
  }

  async applyRulerConfig(
    rules: string,
    projectRoot: string,
    mcpJson: Record<string, unknown> | null,
    agentConfig?: any,
  ): Promise<void> {
    // Mock implementation
  }

  getDefaultOutputPath(projectRoot: string): string {
    return `${projectRoot}/.${this.identifier}/config.json`;
  }

  getMcpServerKey?(): string {
    return 'mcpServers';
  }
}

describe('revert-engine', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-revert-engine-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('revertAgentConfiguration', () => {
    it('should restore files from backup when backup exists', async () => {
      const agent = new MockAgent('Claude Code', 'claude');
      const configPath = path.join(tmpDir, '.claude', 'config.json');
      const backupPath = `${configPath}.bak`;

      // Create directories and files
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, 'current content');
      await fs.writeFile(backupPath, 'backup content');

      const result = await revertAgentConfiguration(
        agent,
        tmpDir,
        undefined,
        false,
        false,
        false
      );

      expect(result.restored).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.backupsRemoved).toBe(1);

      // Check that file was restored
      const restoredContent = await fs.readFile(configPath, 'utf8');
      expect(restoredContent).toBe('backup content');

      // Check that backup was removed
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(false);
    });

    it('should remove generated files when no backup exists', async () => {
      const agent = new MockAgent('Claude Code', 'claude');
      const configPath = path.join(tmpDir, '.claude', 'config.json');

      // Create directories and file (no backup)
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, 'generated content');

      const result = await revertAgentConfiguration(
        agent,
        tmpDir,
        undefined,
        false,
        false,
        false
      );

      expect(result.restored).toBe(0);
      expect(result.removed).toBe(1);
      expect(result.backupsRemoved).toBe(0);

      // Check that file was removed
      const fileExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should keep backups when keepBackups is true', async () => {
      const agent = new MockAgent('Claude Code', 'claude');
      const configPath = path.join(tmpDir, '.claude', 'config.json');
      const backupPath = `${configPath}.bak`;

      // Create directories and files
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, 'current content');
      await fs.writeFile(backupPath, 'backup content');

      const result = await revertAgentConfiguration(
        agent,
        tmpDir,
        undefined,
        true, // keepBackups
        false,
        false
      );

      expect(result.restored).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.backupsRemoved).toBe(0);

      // Check that backup still exists
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should handle dry run mode', async () => {
      const agent = new MockAgent('Claude Code', 'claude');
      const configPath = path.join(tmpDir, '.claude', 'config.json');
      const backupPath = `${configPath}.bak`;

      // Create directories and files
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, 'current content');
      await fs.writeFile(backupPath, 'backup content');

      const result = await revertAgentConfiguration(
        agent,
        tmpDir,
        undefined,
        false,
        false,
        true // dryRun
      );

      expect(result.restored).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.backupsRemoved).toBe(1);

      // Check that files were not actually modified in dry run
      const currentContent = await fs.readFile(configPath, 'utf8');
      expect(currentContent).toBe('current content');

      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should handle non-existent files gracefully', async () => {
      const agent = new MockAgent('Claude Code', 'claude');

      const result = await revertAgentConfiguration(
        agent,
        tmpDir,
        undefined,
        false,
        false,
        false
      );

      expect(result.restored).toBe(0);
      expect(result.removed).toBe(0);
      expect(result.backupsRemoved).toBe(0);
    });
  });

  describe('cleanUpAuxiliaryFiles', () => {
    it('should remove additional files and empty directories', async () => {
      // Create some test directories and files
      const geminiDir = path.join(tmpDir, '.gemini');
      const geminiSettings = path.join(geminiDir, 'settings.json');
      const mcpFile = path.join(tmpDir, '.mcp.json');

      await fs.mkdir(geminiDir, { recursive: true });
      await fs.writeFile(geminiSettings, '{}');
      await fs.writeFile(mcpFile, '{}');

      const result = await cleanUpAuxiliaryFiles(tmpDir, false, false);

      expect(result.additionalFilesRemoved).toBeGreaterThan(0);
      expect(result.directoriesRemoved).toBeGreaterThan(0);
    });

    it('should handle dry run mode', async () => {
      // Create some test files
      const mcpFile = path.join(tmpDir, '.mcp.json');
      await fs.writeFile(mcpFile, '{}');

      const result = await cleanUpAuxiliaryFiles(tmpDir, false, true);

      expect(result.additionalFilesRemoved).toBeGreaterThan(0);

      // Check that file still exists in dry run
      const fileExists = await fs.access(mcpFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should handle non-existent files gracefully', async () => {
      const result = await cleanUpAuxiliaryFiles(tmpDir, false, false);

      expect(result.additionalFilesRemoved).toBeGreaterThanOrEqual(0);
      expect(result.directoriesRemoved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('dry-run logging patterns', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use [ruler:dry-run] prefix when dryRun is true', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create a test file to trigger removal in removeAdditionalAgentFiles
      const mcpFile = path.join(tmpDir, '.mcp.json');
      await fs.writeFile(mcpFile, '{}');

      await cleanUpAuxiliaryFiles(tmpDir, true, true); // verbose=true, dryRun=true
      
      const errorCalls = consoleErrorSpy.mock.calls.flat();
      const hasRulerDryRunPrefix = errorCalls.some(call => 
        typeof call === 'string' && call.includes('[ruler:dry-run]')
      );
      
      expect(hasRulerDryRunPrefix).toBe(true);
      consoleErrorSpy.mockRestore();
    });

    it('should use [ruler] prefix when dryRun is false', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create a test file to trigger removal in removeAdditionalAgentFiles
      const mcpFile = path.join(tmpDir, '.mcp.json');
      await fs.writeFile(mcpFile, '{}');

      await cleanUpAuxiliaryFiles(tmpDir, true, false); // verbose=true, dryRun=false
      
      const errorCalls = consoleErrorSpy.mock.calls.flat();
      const hasRulerPrefix = errorCalls.some(call => 
        typeof call === 'string' && call.includes('[ruler]') && !call.includes('[ruler:dry-run]')
      );
      
      expect(hasRulerPrefix).toBe(true);
      consoleErrorSpy.mockRestore();
    });
  });
});