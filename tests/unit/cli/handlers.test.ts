import {
  applyHandler,
  initHandler,
  revertHandler,
} from '../../../src/cli/handlers';
import { applyAllAgentConfigs } from '../../../src/lib';
import { revertAllAgentConfigs } from '../../../src/revert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock the external dependencies
jest.mock('../../../src/lib');
jest.mock('../../../src/revert');
jest.mock('fs/promises');

describe('CLI Handlers', () => {
  const mockProjectRoot = '/mock/project/root';
  const mockError = new Error('Test error');

  beforeEach(() => {
    jest.clearAllMocks();
    (applyAllAgentConfigs as jest.Mock).mockResolvedValue(undefined);
    (revertAllAgentConfigs as jest.Mock).mockResolvedValue(undefined);
  });

  describe('applyHandler', () => {
    it('should call applyAllAgentConfigs with correct parameters', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        agents: 'copilot,claude',
        config: '/path/to/config.toml',
        mcp: true,
        'mcp-overwrite': false,
        gitignore: true,
        verbose: true,
        'dry-run': false,
        'local-only': false,
      };

      await applyHandler(argv);

      expect(applyAllAgentConfigs).toHaveBeenCalledWith(
        mockProjectRoot,
        ['copilot', 'claude'],
        '/path/to/config.toml',
        true,
        undefined,
        true,
        true,
        false,
        false,
      );
    });

    it('should handle mcp-overwrite correctly', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': true,
        verbose: false,
        'dry-run': false,
        'local-only': false,
      };

      await applyHandler(argv);

      expect(applyAllAgentConfigs).toHaveBeenCalledWith(
        mockProjectRoot,
        undefined,
        undefined,
        true,
        'overwrite',
        undefined,
        false,
        false,
        false,
      );
    });

    it('should handle gitignore preference correctly', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        gitignore: false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
      };

      await applyHandler(argv);

      expect(applyAllAgentConfigs).toHaveBeenCalledWith(
        mockProjectRoot,
        undefined,
        undefined,
        true,
        undefined,
        false,
        false,
        false,
        false,
      );
    });

    it('should handle undefined gitignore correctly', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
      };

      await applyHandler(argv);

      expect(applyAllAgentConfigs).toHaveBeenCalledWith(
        mockProjectRoot,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
      );
    });

    it('should exit with error code 1 when applyAllAgentConfigs throws', async () => {
      (applyAllAgentConfigs as jest.Mock).mockRejectedValue(mockError);

      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: number) => {
          throw new Error(`process.exit: ${code}`);
        });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
      };

      await expect(applyHandler(argv)).rejects.toThrow('process.exit: 1');

      expect(errorSpy).toHaveBeenCalledWith('[ruler] Test error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('initHandler', () => {
    const mockRulerDir = path.join(mockProjectRoot, '.ruler');
    const mockInstructionsPath = path.join(mockRulerDir, 'instructions.md');
    const mockTomlPath = path.join(mockRulerDir, 'ruler.toml');
    const mockMcpPath = path.join(mockRulerDir, 'mcp.json');

    beforeEach(() => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should create .ruler directory and default files', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        global: false,
      };

      await initHandler(argv);

      expect(fs.mkdir).toHaveBeenCalledWith(mockRulerDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockInstructionsPath,
        expect.stringContaining('# Ruler Instructions'),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockTomlPath,
        expect.stringContaining('# Ruler Configuration File'),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockMcpPath,
        expect.stringContaining('mcpServers'),
      );
    });

    it('should handle global initialization', async () => {
      const mockGlobalDir = path.join(os.homedir(), '.config', 'ruler');
      const argv = {
        'project-root': mockProjectRoot,
        global: true,
      };

      await initHandler(argv);

      expect(fs.mkdir).toHaveBeenCalledWith(mockGlobalDir, { recursive: true });
    });

    it('should handle custom XDG_CONFIG_HOME for global initialization', async () => {
      const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
      process.env.XDG_CONFIG_HOME = '/custom/config/path';

      const mockCustomDir = path.join('/custom/config/path', 'ruler');
      const argv = {
        'project-root': mockProjectRoot,
        global: true,
      };

      await initHandler(argv);

      expect(fs.mkdir).toHaveBeenCalledWith(mockCustomDir, { recursive: true });

      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    });

    it('should skip creating files that already exist', async () => {
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // instructions.md exists
        .mockResolvedValueOnce(undefined) // ruler.toml exists
        .mockResolvedValueOnce(undefined); // mcp.json exists

      const argv = {
        'project-root': mockProjectRoot,
        global: false,
      };

      await initHandler(argv);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('revertHandler', () => {
    it('should call revertAllAgentConfigs with correct parameters', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        agents: 'copilot,claude',
        config: '/path/to/config.toml',
        'keep-backups': true,
        verbose: true,
        'dry-run': false,
        'local-only': false,
      };

      await revertHandler(argv);

      expect(revertAllAgentConfigs).toHaveBeenCalledWith(
        mockProjectRoot,
        ['copilot', 'claude'],
        '/path/to/config.toml',
        true,
        true,
        false,
        false,
      );
    });

    it('should handle undefined agents correctly', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        'keep-backups': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
      };

      await revertHandler(argv);

      expect(revertAllAgentConfigs).toHaveBeenCalledWith(
        mockProjectRoot,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
      );
    });

    it('should exit with error code 1 when revertAllAgentConfigs throws', async () => {
      (revertAllAgentConfigs as jest.Mock).mockRejectedValue(mockError);

      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: number) => {
          throw new Error(`process.exit: ${code}`);
        });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const argv = {
        'project-root': mockProjectRoot,
        'keep-backups': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
      };

      await expect(revertHandler(argv)).rejects.toThrow('process.exit: 1');

      expect(errorSpy).toHaveBeenCalledWith('[ruler] Test error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
