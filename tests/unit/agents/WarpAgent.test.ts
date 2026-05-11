import { WarpAgent } from '../../../src/agents/WarpAgent';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';
import { revertAllAgentConfigs } from '../../../src/revert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Only mock FileSystemUtils for unit tests, not integration tests
jest.mock('../../../src/core/FileSystemUtils', () => {
  const actual = jest.requireActual('../../../src/core/FileSystemUtils');
  return {
    ...actual,
    writeGeneratedFile: jest.fn(),
    backupFile: jest.fn(),
  };
});

describe('WarpAgent', () => {
  let agent: WarpAgent;

  beforeEach(() => {
    agent = new WarpAgent();
    (FileSystemUtils.writeGeneratedFile as jest.Mock).mockClear();
    (FileSystemUtils.backupFile as jest.Mock).mockClear();
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('warp');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Warp');
  });

  it('should return the correct default output path', () => {
    const base = path.join(os.tmpdir(), 'warp-agent-path-test');
    expect(agent.getDefaultOutputPath(base)).toBe(path.join(base, 'WARP.md'));
  });

  it('should not support MCP STDIO servers', () => {
    expect(agent.supportsMcpStdio()).toBe(false);
  });

  it('should not support MCP remote servers', () => {
    expect(agent.supportsMcpRemote()).toBe(false);
  });

  it('should apply ruler config to the default output path', async () => {
    const backupFile = jest.spyOn(FileSystemUtils, 'backupFile');
    const writeGeneratedFile = jest.spyOn(
      FileSystemUtils,
      'writeGeneratedFile',
    );
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'warp-agent-default-'));
    await agent.applyRulerConfig('rules', base, null);
    const expected = path.join(base, 'WARP.md');
    expect(backupFile).toHaveBeenCalledWith(expected);
    expect(writeGeneratedFile).toHaveBeenCalledWith(expected, 'rules');
  });

  it('should apply ruler config to custom output path', async () => {
    const backupFile = jest.spyOn(FileSystemUtils, 'backupFile');
    const writeGeneratedFile = jest.spyOn(
      FileSystemUtils,
      'writeGeneratedFile',
    );
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'warp-agent-custom-'));
    await agent.applyRulerConfig('rules', base, null, { outputPath: 'CUSTOM.md' });
    const expected = path.join(base, 'CUSTOM.md');
    expect(backupFile).toHaveBeenCalledWith(expected);
    expect(writeGeneratedFile).toHaveBeenCalledWith(expected, 'rules');
  });

  describe('integration with backup and revert functionality', () => {
    let tmpDir: string;
    let realAgent: WarpAgent;
    let originalWriteGeneratedFile: any;

    beforeEach(async () => {
      // Restore the real writeGeneratedFile implementation for integration tests
      originalWriteGeneratedFile = jest.requireActual(
        '../../../src/core/FileSystemUtils',
      ).writeGeneratedFile;
      (FileSystemUtils.writeGeneratedFile as jest.Mock).mockImplementation(
        originalWriteGeneratedFile,
      );

      // Also restore backupFile for integration tests
      const originalBackupFile = jest.requireActual(
        '../../../src/core/FileSystemUtils',
      ).backupFile;
      (FileSystemUtils.backupFile as jest.Mock).mockImplementation(
        originalBackupFile,
      );

      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'warp-revert-test-'));
      realAgent = new WarpAgent();
    });

    afterEach(async () => {
      // Clean up the temporary directory
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should create backup when overwriting existing WARP.md file', async () => {
      const agentPath = path.join(tmpDir, 'WARP.md');
      const originalContent = 'Original content';
      const newContent = 'New rules';

      // Create original file
      await fs.writeFile(agentPath, originalContent);

      // Apply new rules (WarpAgent itself doesn't create backups, that's handled by the apply-engine)
      await realAgent.applyRulerConfig(newContent, tmpDir, null);

      // Verify new content is written
      const content = await fs.readFile(agentPath, 'utf8');
      expect(content).toBe(newContent);
    });

    it('should be properly reverted by revertAllAgentConfigs', async () => {
      const rules = 'Warp agent rules';
      
      // Create minimal .ruler structure needed for revert
      const rulerDir = path.join(tmpDir, '.ruler');
      await fs.mkdir(rulerDir, { recursive: true });
      
      // Apply rules first
      await realAgent.applyRulerConfig(rules, tmpDir, null);

      const agentPath = path.join(tmpDir, 'WARP.md');

      // Verify file exists
      await expect(fs.access(agentPath)).resolves.toBeUndefined();

      // Revert warp agent
      await revertAllAgentConfigs(
        tmpDir,
        ['warp'],
        undefined, // configPath
        false, // keepBackups
        false, // verbose
        false, // dry run
      );

      // Verify file is removed after revert
      await expect(fs.access(agentPath)).rejects.toThrow();
    });
  });
});