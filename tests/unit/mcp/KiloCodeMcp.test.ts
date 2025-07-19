import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';
import {
  getNativeMcpPath,
  readNativeMcp,
  writeNativeMcp,
} from '../../../src/paths/mcp';
import { mergeMcp } from '../../../src/mcp/merge';

interface McpConfig {
  mcpServers: Record<string, { command: string; args?: string[] }>;
  [key: string]: unknown;
}

describe('KiloCode MCP Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-kilocode-mcp-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('MCP Path Resolution', () => {
    it('resolves correct MCP path for Kilo Code', async () => {
      const mcpPath = await getNativeMcpPath('Kilo Code', tmpDir);
      expect(mcpPath).toBe(path.join(tmpDir, '.kilocode', 'mcp.json'));
    });

    it('returns first candidate path when file does not exist', async () => {
      const mcpPath = await getNativeMcpPath('Kilo Code', tmpDir);
      expect(mcpPath).toBe(path.join(tmpDir, '.kilocode', 'mcp.json'));
    });
  });

  describe('MCP Configuration Handling', () => {
    it('creates new MCP configuration file', async () => {
      const mcpPath = path.join(tmpDir, '.kilocode', 'mcp.json');
      const mcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir],
          },
        },
      };

      await writeNativeMcp(mcpPath, mcpConfig);

      // Verify file was created
      await expect(fs.access(mcpPath)).resolves.toBeUndefined();

      const content = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
      expect(content.mcpServers.filesystem.command).toBe('npx');
      expect(content.mcpServers.filesystem.args).toEqual([
        '-y',
        '@modelcontextprotocol/server-filesystem',
        tmpDir,
      ]);
    });

    it('reads existing MCP configuration', async () => {
      const mcpPath = path.join(tmpDir, '.kilocode', 'mcp.json');
      const existingConfig = {
        mcpServers: {
          existing: {
            command: 'existing-command',
            args: ['existing-arg'],
          },
        },
      };

      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify(existingConfig, null, 2));

      const readConfig = await readNativeMcp(mcpPath);
      expect(readConfig).toEqual(existingConfig);
    });

    it('returns empty object for non-existent MCP file', async () => {
      const mcpPath = path.join(tmpDir, '.kilocode', 'nonexistent.json');
      const config = await readNativeMcp(mcpPath);
      expect(config).toEqual({});
    });

    it('merges MCP configurations correctly', async () => {
      const existing = {
        mcpServers: {
          existing: { command: 'existing-cmd', args: ['existing-arg'] },
        },
      };

      const newConfig = {
        mcpServers: {
          filesystem: { command: 'npx', args: ['mcp-filesystem'] },
        },
      };

      const merged = mergeMcp(
        existing,
        newConfig,
        'merge',
        'mcpServers',
      ) as McpConfig;

      expect(merged.mcpServers.existing).toEqual({
        command: 'existing-cmd',
        args: ['existing-arg'],
      });
      expect(merged.mcpServers.filesystem).toEqual({
        command: 'npx',
        args: ['mcp-filesystem'],
      });
    });

    it('overwrites MCP configurations with overwrite strategy', async () => {
      const existing = {
        mcpServers: {
          existing: { command: 'existing-cmd' },
        },
      };

      const newConfig = {
        mcpServers: {
          filesystem: { command: 'npx', args: ['mcp-filesystem'] },
        },
      };

      const merged = mergeMcp(
        existing,
        newConfig,
        'overwrite',
        'mcpServers',
      ) as McpConfig;

      expect(merged.mcpServers.existing).toBeUndefined();
      expect(merged.mcpServers.filesystem).toEqual({
        command: 'npx',
        args: ['mcp-filesystem'],
      });
    });

    it('overwrites servers with same name during merge', async () => {
      const existing = {
        mcpServers: {
          filesystem: { command: 'old-command', args: ['old-arg'] },
        },
      };

      const newConfig = {
        mcpServers: {
          filesystem: { command: 'new-command', args: ['new-arg'] },
        },
      };

      const merged = mergeMcp(
        existing,
        newConfig,
        'merge',
        'mcpServers',
      ) as McpConfig;

      expect(merged.mcpServers.filesystem).toEqual({
        command: 'new-command',
        args: ['new-arg'],
      });
    });

    it('preserves non-MCP properties during merge', async () => {
      const existing = {
        mcpServers: {
          existing: { command: 'existing-cmd' },
        },
        otherProperty: 'preserved',
      };

      const newConfig = {
        mcpServers: {
          filesystem: { command: 'npx' },
        },
      };

      const merged = mergeMcp(
        existing,
        newConfig,
        'merge',
        'mcpServers',
      ) as McpConfig;

      expect(merged.otherProperty).toBe('preserved');
      expect(merged.mcpServers.existing).toEqual({ command: 'existing-cmd' });
      expect(merged.mcpServers.filesystem).toEqual({ command: 'npx' });
    });
  });
});
