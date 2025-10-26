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
import { loadConfig } from '../../../src/core/ConfigLoader';

// Mock the external dependencies
jest.mock('../../../src/lib');
jest.mock('../../../src/revert');
jest.mock('fs/promises');
jest.mock('../../../src/core/ConfigLoader');

describe('CLI Handlers', () => {
  const mockProjectRoot = '/mock/project/root';
  const mockError = new Error('Test error');

  beforeEach(() => {
    jest.clearAllMocks();
    (applyAllAgentConfigs as jest.Mock).mockResolvedValue(undefined);
    (revertAllAgentConfigs as jest.Mock).mockResolvedValue(undefined);
    // Mock loadConfig to return default config
    (loadConfig as jest.Mock).mockResolvedValue({
      defaultAgents: undefined,
      agentConfigs: {},
      cliAgents: undefined,
      mcp: {},
      gitignore: {},
      nested: false,
    });
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
        nested: false,
        backup: true,
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
        false,
        true, undefined,
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
        nested: false,
        backup: true,
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
        false,
        true, undefined,
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
        nested: false,
        backup: true,
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
        false,
        true, undefined,
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
        nested: false,
        backup: true,
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
        false,
        true, undefined,
      );
    });

    it('should use CLI nested value when explicitly provided', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
        nested: true,
        backup: true,
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
        true, // nested should be true from CLI
        true, undefined,
      );
      // loadConfig should not be called when CLI explicitly sets nested
      expect(loadConfig).not.toHaveBeenCalled();
    });

    it('should use TOML nested value when CLI does not provide it', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        defaultAgents: undefined,
        agentConfigs: {},
        cliAgents: undefined,
        mcp: {},
        gitignore: {},
        nested: true, // nested = true in TOML
      });

      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
        // nested is undefined (not provided by CLI)
        backup: true,
      };

      await applyHandler(argv);

      expect(loadConfig).toHaveBeenCalledWith({
        projectRoot: mockProjectRoot,
        configPath: undefined,
      });
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
        true, // nested should be true from TOML
        true, undefined,
      );
    });

    it('should default to false when CLI and TOML do not provide nested', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        defaultAgents: undefined,
        agentConfigs: {},
        cliAgents: undefined,
        mcp: {},
        gitignore: {},
        nested: undefined, // not in TOML either
      });

      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
        // nested is undefined (not provided by CLI)
        backup: true,
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
        false, // nested should default to false
        true, undefined,
      );
    });

    it('should prefer CLI --nested over TOML nested = false', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        defaultAgents: undefined,
        agentConfigs: {},
        cliAgents: undefined,
        mcp: {},
        gitignore: {},
        nested: false, // nested = false in TOML
      });

      const argv = {
        'project-root': mockProjectRoot,
        mcp: true,
        'mcp-overwrite': false,
        verbose: false,
        'dry-run': false,
        'local-only': false,
        nested: true, // CLI overrides TOML
        backup: true,
      };

      await applyHandler(argv);

      // loadConfig should not be called when CLI explicitly sets nested
      expect(loadConfig).not.toHaveBeenCalled();
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
        true, // nested should be true from CLI, ignoring TOML
        true, undefined,
      );
    });

    it('should exit with error code 1 when applyAllAgentConfigs throws', async () => {
      (applyAllAgentConfigs as jest.Mock).mockRejectedValue(mockError);

      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null | undefined) => {
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
        nested: false,
        backup: true,
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
    const mockInstructionsPath = path.join(mockRulerDir, 'AGENTS.md');
    const mockTomlPath = path.join(mockRulerDir, 'ruler.toml');
    const mockLegacyPath = path.join(mockRulerDir, 'instructions.md');

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
        expect.stringContaining('# AGENTS.md'),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockTomlPath,
        expect.stringContaining('# Ruler Configuration File'),
      );
    });

    it('should NOT create mcp.json file', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        global: false,
      };

      await initHandler(argv);

      // Verify mcp.json is never written
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('mcp.json'),
        expect.anything(),
      );
    });

    it('should include sample MCP server sections in ruler.toml', async () => {
      const argv = {
        'project-root': mockProjectRoot,
        global: false,
      };

      await initHandler(argv);

      // Find the call that writes to ruler.toml
      const tomlWriteCall = (fs.writeFile as jest.Mock).mock.calls.find(
        (call) => call[0] === mockTomlPath,
      );

      expect(tomlWriteCall).toBeDefined();
      const tomlContent = tomlWriteCall[1];

      // Verify MCP server sections are present
      expect(tomlContent).toContain('# --- MCP Servers ---');
      expect(tomlContent).toContain('[mcp_servers.example_stdio]');
      expect(tomlContent).toContain('[mcp_servers.example_remote]');
      expect(tomlContent).toContain('# command = "node"');
      expect(tomlContent).toContain('# url = "https://api.example.com/mcp"');
    });

    it('should handle global initialization', async () => {
      const mockGlobalDir = path.join(os.homedir(), '.config', 'ruler');
      const argv = {
        'project-root': mockProjectRoot,
        global: true,
      };

      // Mock the mkdir to resolve successfully
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await initHandler(argv);

      expect(fs.mkdir).toHaveBeenCalledWith(mockGlobalDir, { recursive: true });
    });

    it('should handle custom XDG_CONFIG_HOME for global initialization', async () => {
      const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
      process.env.XDG_CONFIG_HOME = '/tmp/custom/config/path';

      const mockCustomDir = path.join('/tmp/custom/config/path', 'ruler');
      const argv = {
        'project-root': mockProjectRoot,
        global: true,
      };

      // Mock the mkdir to resolve successfully
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await initHandler(argv);

      expect(fs.mkdir).toHaveBeenCalledWith(mockCustomDir, { recursive: true });

      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    });

    it('should skip creating files that already exist', async () => {
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // instructions.md exists
        .mockResolvedValueOnce(undefined); // ruler.toml exists

      const argv = {
        'project-root': mockProjectRoot,
        global: false,
      };

      await initHandler(argv);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should create AGENTS.md when legacy instructions.md exists (legacy preserved silently)', async () => {
      // access sequence: AGENTS.md (fail), legacy instructions.md (exists), ruler.toml (fail)
      (fs.access as jest.Mock)
        .mockRejectedValueOnce(new Error('AGENTS missing'))
        .mockResolvedValueOnce(undefined) // legacy exists
        .mockRejectedValueOnce(new Error('toml missing'));
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const argv = { 'project-root': mockProjectRoot, global: false };
      // Simulate legacy existing by making read of legacy path succeed when probed later (we'll implement probe)
      // We'll adjust implementation to check legacy path existence separately.
      await initHandler(argv);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockInstructionsPath,
        expect.stringContaining('# AGENTS.md'),
      );
      // Expect a notice about legacy detection once implementation added
      // No legacy notice expected anymore
      expect(
        logSpy.mock.calls.some((c) =>
          /legacy instructions\.md detected/i.test(c[0]),
        ),
      ).toBe(false);
      logSpy.mockRestore();
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
        .mockImplementation((code?: string | number | null | undefined) => {
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
