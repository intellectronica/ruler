import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';
import { AugmentCodeAgent } from '../../../src/agents/AugmentCodeAgent';

describe('AugmentCodeAgent', () => {
  let tmpDir: string;
  let agent: AugmentCodeAgent;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-augmentcode-'));
    agent = new AugmentCodeAgent();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('agent properties', () => {
    it('returns correct identifier', () => {
      expect(agent.getIdentifier()).toBe('augmentcode');
    });

    it('returns correct name', () => {
      expect(agent.getName()).toBe('AugmentCode');
    });

    it('returns correct default output path', () => {
      const expected = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });

    it('returns correct MCP server key', () => {
      expect(agent.getMcpServerKey()).toBe('mcpServers');
    });
  });

  describe('applyRulerConfig', () => {
    it('creates ruler_augment_instructions.md file', async () => {
      const target = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      await agent.applyRulerConfig('test guidelines', tmpDir, null);

      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('test guidelines');
    });

    it('backs up existing ruler_augment_instructions.md file', async () => {
      const target = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'old guidelines');

      await agent.applyRulerConfig('new guidelines', tmpDir, null);

      const backup = await fs.readFile(`${target}.bak`, 'utf8');
      const content = await fs.readFile(target, 'utf8');
      expect(backup).toBe('old guidelines');
      expect(content).toBe('new guidelines');
    });

    it('uses custom output path when provided', async () => {
      const customPath = path.join(tmpDir, 'custom-guidelines.md');
      await agent.applyRulerConfig('custom guidelines', tmpDir, null, { 
        outputPath: customPath 
      });
      
      const content = await fs.readFile(customPath, 'utf8');
      expect(content).toBe('custom guidelines');
    });

    it('creates MCP configuration when provided', async () => {
      const mcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
          }
        }
      };

      await agent.applyRulerConfig('test guidelines', tmpDir, mcpConfig);

      const settingsPath = path.join(tmpDir, '.vscode', 'settings.json');
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      const parsedSettings = JSON.parse(settingsContent);

      expect(parsedSettings['augment.advanced'].mcpServers).toEqual([
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
        }
      ]);
    });

    it('merges with existing MCP configuration', async () => {
      const settingsPath = path.join(tmpDir, '.vscode', 'settings.json');
      const existingSettings = {
        'augment.advanced': {
          mcpServers: [
            {
              name: 'existing',
              command: 'existing-command',
              args: ['existing-arg']
            }
          ]
        },
        'other.setting': {
          value: 'preserved'
        }
      };

      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings, null, 4));

      const newMcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
          }
        }
      };

      await agent.applyRulerConfig('test guidelines', tmpDir, newMcpConfig);

      const updatedContent = await fs.readFile(settingsPath, 'utf8');
      const updatedSettings = JSON.parse(updatedContent);

      // Should have both existing and new servers
      const mcpServers = updatedSettings['augment.advanced'].mcpServers;
      expect(mcpServers).toHaveLength(2);
      expect(mcpServers.find((s: any) => s.name === 'existing')).toEqual({
        name: 'existing',
        command: 'existing-command',
        args: ['existing-arg']
      });
      expect(mcpServers.find((s: any) => s.name === 'filesystem')).toEqual({
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
      });
      // Other settings should be preserved
      expect(updatedSettings['other.setting']).toEqual(existingSettings['other.setting']);
    });

    it('uses overwrite strategy when specified', async () => {
      const settingsPath = path.join(tmpDir, '.vscode', 'settings.json');
      const existingSettings = {
        'augment.advanced': {
          mcpServers: [
            {
              name: 'existing',
              command: 'existing-command'
            }
          ]
        }
      };

      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings, null, 4));

      const newMcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
          }
        }
      };

      await agent.applyRulerConfig('test guidelines', tmpDir, newMcpConfig, {
        mcp: { strategy: 'overwrite' }
      });

      const updatedContent = await fs.readFile(settingsPath, 'utf8');
      const updatedSettings = JSON.parse(updatedContent);

      // Should only have new servers, existing should be gone
      const mcpServers = updatedSettings['augment.advanced'].mcpServers;
      expect(mcpServers).toHaveLength(1);
      expect(mcpServers[0]).toEqual({
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
      });
    });
  });
});