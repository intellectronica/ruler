import * as path from 'path';
import * as os from 'os';
import { getNativeMcpPath } from '../../../src/paths/mcp';

describe('MCP Path Resolution', () => {
  const projectRoot = '/test/project';
  const home = os.homedir();

  describe('getNativeMcpPath', () => {
    it('should never return paths outside the project root', async () => {
      // Test all agents that currently have home directory paths
      const agentsToTest = [
        'Windsurf',
        'OpenAI Codex CLI', 
        'Cursor',
        'OpenCode'
      ];

      for (const agent of agentsToTest) {
        const mcpPath = await getNativeMcpPath(agent, projectRoot);
        
        // If a path is returned, it must be within the project root
        if (mcpPath) {
          expect(mcpPath.startsWith(projectRoot)).toBe(true);
          expect(mcpPath.startsWith(home)).toBe(false);
        }
      }
    });

    it('should return project-local paths for all supported agents', async () => {
      const supportedAgents = [
        'GitHub Copilot',
        'Visual Studio', 
        'Cursor',
        'Windsurf',
        'Claude Code',
        'OpenAI Codex CLI',
        'Aider',
        'Open Hands',
        'Gemini CLI',
        'Qwen Code',
        'Kilo Code',
        'Kiro',
        'OpenCode',
        'Zed',
        'Firebase Studio'
      ];

      for (const agent of supportedAgents) {
        const mcpPath = await getNativeMcpPath(agent, projectRoot);
        
        // All supported agents should return a path
        expect(mcpPath).not.toBeNull();
        
        // And it should be within the project root
        if (mcpPath) {
          expect(mcpPath.startsWith(projectRoot)).toBe(true);
        }
      }
    });

    it('should return null for unsupported agents', async () => {
      const mcpPath = await getNativeMcpPath('Unsupported Agent', projectRoot);
      expect(mcpPath).toBeNull();
    });

    describe('specific agent paths', () => {
      it('Windsurf should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('Windsurf', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.windsurf', 'mcp_config.json'));
      });

      it('OpenAI Codex CLI should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('OpenAI Codex CLI', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.codex', 'config.json'));
      });

      it('Cursor should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('Cursor', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.cursor', 'mcp.json'));
      });

      it('OpenCode should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('OpenCode', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, 'opencode.json'));
      });

      it('GitHub Copilot should use correct project-local path', async () => {
        const mcpPath = await getNativeMcpPath('GitHub Copilot', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.vscode', 'mcp.json'));
      });

      it('Zed should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('Zed', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.zed', 'settings.json'));
      });

      it('Firebase Studio should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('Firebase Studio', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.idx', 'mcp.json'));
      });

      it('Kiro should use project-local path', async () => {
        const mcpPath = await getNativeMcpPath('Kiro', projectRoot);
        expect(mcpPath).toBe(path.join(projectRoot, '.kiro', 'settings', 'mcp.json'));
      });
    });
  });
});