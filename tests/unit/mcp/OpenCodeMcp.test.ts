import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { getNativeMcpPath, writeNativeMcp } from '../../../src/paths/mcp';
import { propagateMcpToOpenCode } from '../../../src/mcp/propagateOpenCodeMcp';

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

    it('transforms ruler MCP config to OpenCode format for local servers', async () => {
      const openCodePath = path.join(tmpDir, 'opencode.json');

      const rulerMcp = {
        mcpServers: {
          'my-local-server': {
            command: 'bun',
            args: ['x', 'my-mcp-command'],
            env: {
              MY_ENV_VAR: 'my_env_var_value',
            },
          },
        },
      };

      await propagateMcpToOpenCode(rulerMcp, openCodePath);

      const result = JSON.parse(await fs.readFile(openCodePath, 'utf8'));

      expect(result.$schema).toBe('https://opencode.ai/config.json');
      expect(result.mcp['my-local-server']).toEqual({
        type: 'local',
        command: ['bun', 'x', 'my-mcp-command'],
        enabled: true,
        environment: {
          MY_ENV_VAR: 'my_env_var_value',
        },
      });
    });

    it('transforms ruler MCP config to OpenCode format for remote servers', async () => {
      const openCodePath = path.join(tmpDir, 'opencode.json');

      const rulerMcp = {
        mcpServers: {
          'my-remote-server': {
            url: 'https://my-mcp-server.com',
            headers: {
              Authorization: 'Bearer MY_API_KEY',
            },
          },
        },
      };

      await propagateMcpToOpenCode(rulerMcp, openCodePath);

      const result = JSON.parse(await fs.readFile(openCodePath, 'utf8'));

      expect(result.$schema).toBe('https://opencode.ai/config.json');
      expect(result.mcp['my-remote-server']).toEqual({
        type: 'remote',
        url: 'https://my-mcp-server.com',
        enabled: true,
        headers: {
          Authorization: 'Bearer MY_API_KEY',
        },
      });
    });

    it('merges with existing OpenCode configuration', async () => {
      const openCodePath = path.join(tmpDir, 'opencode.json');

      // Create existing OpenCode config
      const existingConfig = {
        $schema: 'https://opencode.ai/config.json',
        mcp: {
          'existing-server': {
            type: 'local',
            command: ['existing-command'],
            enabled: true,
          },
        },
        otherSetting: 'preserved',
      };
      await fs.writeFile(openCodePath, JSON.stringify(existingConfig));

      // Create ruler MCP config
      const rulerMcp = {
        mcpServers: {
          'new-server': {
            command: 'new-command',
          },
        },
      };

      await propagateMcpToOpenCode(rulerMcp, openCodePath);

      const result = JSON.parse(await fs.readFile(openCodePath, 'utf8'));

      expect(result.otherSetting).toBe('preserved');
      expect(result.mcp['existing-server']).toEqual({
        type: 'local',
        command: ['existing-command'],
        enabled: true,
      });
      expect(result.mcp['new-server']).toEqual({
        type: 'local',
        command: ['new-command'],
        enabled: true,
      });
    });

    it('creates minimal opencode.json when no ruler MCP config exists', async () => {
      const openCodePath = path.join(tmpDir, 'opencode.json');

      // Call propagation with null MCP data
      await propagateMcpToOpenCode(null, openCodePath);

      // Should create minimal opencode.json
      const result = JSON.parse(await fs.readFile(openCodePath, 'utf8'));

      expect(result.$schema).toBe('https://opencode.ai/config.json');
      expect(result.mcp).toEqual({});
    });

    it('creates minimal opencode.json when ruler MCP config is empty', async () => {
      const openCodePath = path.join(tmpDir, 'opencode.json');

      // Create empty ruler MCP config
      const rulerMcp = {};

      await propagateMcpToOpenCode(rulerMcp, openCodePath);

      // Should create minimal opencode.json
      const result = JSON.parse(await fs.readFile(openCodePath, 'utf8'));

      expect(result.$schema).toBe('https://opencode.ai/config.json');
      expect(result.mcp).toEqual({});
    });
  });
});
