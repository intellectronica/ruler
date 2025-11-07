import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { revertAllAgentConfigs } from '../../src/revert';

describe('Revert Agent Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-agent-integration-'));
    
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'instructions.md'), 'Test Rule');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Agent-Specific Revert', () => {
    it('should revert only Claude agent files', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Claude content');
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), 'Agents content');
      
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);
      
      await expect(fs.access(path.join(tmpDir, 'CLAUDE.md'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).resolves.toBeUndefined();
    });

    it('should revert multiple specific agents', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Claude content');
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), 'Agents content');
      await fs.writeFile(path.join(tmpDir, 'CRUSH.md'), 'Crush content');

      await revertAllAgentConfigs(tmpDir, ['claude', 'crush'], undefined, false, false, false);

      await expect(fs.access(path.join(tmpDir, 'CLAUDE.md'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, 'CRUSH.md'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).resolves.toBeUndefined();
    });

    it('should handle agent with multiple output paths (AiderAgent)', async () => {
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), 'Aider instructions');
      await fs.writeFile(path.join(tmpDir, '.aider.conf.yml'), 'read: [AGENTS.md]');
      
      await revertAllAgentConfigs(tmpDir, ['aider'], undefined, false, false, false);
      
      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, '.aider.conf.yml'))).rejects.toThrow();
    });

    it('should handle KiloCode agent files and directories', async () => {
      // Create KiloCode directory structure
      await fs.mkdir(path.join(tmpDir, '.kilocode', 'rules'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.kilocode', 'rules', 'ruler_kilocode_instructions.md'), 'KiloCode instructions');
      await fs.writeFile(path.join(tmpDir, '.kilocode', 'mcp.json'), '{"mcpServers": {}}');

      await revertAllAgentConfigs(tmpDir, ['kilocode'], undefined, false, false, false);

      await expect(fs.access(path.join(tmpDir, '.kilocode'))).rejects.toThrow();
    });
  });

  describe('Directory Cleanup', () => {
    it('should remove empty agent directories', async () => {
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), 'Copilot content');

      await fs.mkdir(path.join(tmpDir, '.augment', 'rules'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md'), 'Augment content');

      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);

      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, '.augment'))).rejects.toThrow();
    });

    it('should preserve directories with non-ruler content', async () => {
      await fs.mkdir(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), 'Copilot content');
      await fs.writeFile(path.join(tmpDir, '.github', 'workflows', 'ci.yml'), 'Existing workflow');

      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);

      await expect(fs.access(path.join(tmpDir, '.github'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(tmpDir, '.github', 'workflows', 'ci.yml'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).rejects.toThrow();
    });
  });

  describe('MCP File Handling', () => {
    it('should handle MCP configuration files', async () => {
      await fs.writeFile(path.join(tmpDir, '.mcp.json'), '{"mcpServers": {}}');
      await fs.mkdir(path.join(tmpDir, '.vscode'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.vscode', 'mcp.json'), '{"mcpServers": {}}');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(path.join(tmpDir, '.mcp.json'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, '.vscode', 'mcp.json'))).rejects.toThrow();
    });
  });

  describe('Backup and Restore', () => {
    it('should restore files from backups correctly', async () => {
      const claudePath = path.join(tmpDir, 'CLAUDE.md');
      const backupPath = `${claudePath}.bak`;

      await fs.writeFile(backupPath, 'Original Claude');
      await fs.writeFile(claudePath, 'Modified Claude');

      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);

      const claudeContent = await fs.readFile(claudePath, 'utf8');
      expect(claudeContent).toBe('Original Claude');
    });

    it('should handle mixed backup and generated files', async () => {
      const claudePath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(`${claudePath}.bak`, 'Original Claude');
      await fs.writeFile(claudePath, 'Modified Claude');
      
      const agentsPath = path.join(tmpDir, 'AGENTS.md');
      await fs.writeFile(agentsPath, 'Generated Agents');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      const claudeContent = await fs.readFile(claudePath, 'utf8');
      expect(claudeContent).toBe('Original Claude');
      
      await expect(fs.access(agentsPath)).rejects.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should handle basic configuration loading', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Claude content');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Files processed:'));

      consoleSpy.mockRestore();
    });
  });
});
