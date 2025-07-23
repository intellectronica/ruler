import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import {
  getNativeMcpPath,
  readNativeMcp,
  writeNativeMcp,
} from '../../../src/paths/mcp';
import { mergeMcp } from '../../../src/mcp/merge';

describe('OpenCode MCP Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-opencode-mcp-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('MCP Path Resolution', () => {
    it('resolves correct MCP path for OpenCode', async () => {
      const mcpPath = await getNativeMcpPath('OpenCode', tmpDir);
      expect(mcpPath).toBe(path.join(tmpDir, 'opencode.json'));
    });
  });

  describe('MCP Configuration Handling', () => {
    it('creates new MCP configuration file', async () => {
      const mcpPath = path.join(tmpDir, 'opencode.json');
      const mcpConfig = {
        mcp: {
          'my-server': {
            command: 'test-command',
          },
        },
      };

      await writeNativeMcp(mcpPath, mcpConfig);
      const content = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
      expect(content.mcp['my-server'].command).toBe('test-command');
    });

    it('merges MCP configurations correctly', async () => {
      const existing = {
        mcp: {
          'existing-server': { command: 'existing-cmd' },
        },
      };

      const newConfig = {
        mcpServers: {
          'new-server': { command: 'new-cmd' },
        },
      };

      const merged: any = mergeMcp(existing, newConfig, 'merge', 'mcp');

      expect(merged.mcp['existing-server'].command).toBe('existing-cmd');
      expect(merged.mcp['new-server'].command).toBe('new-cmd');
    });
  });
});
