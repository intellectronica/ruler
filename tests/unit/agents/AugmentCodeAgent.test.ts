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
      const expected = path.join(tmpDir, '.augment-guidelines');
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });

    it('returns correct MCP server key', () => {
      expect(agent.getMcpServerKey()).toBe('mcpServers');
    });
  });

  describe('applyRulerConfig', () => {
    it('creates .augment-guidelines file', async () => {
      const target = path.join(tmpDir, '.augment-guidelines');
      await agent.applyRulerConfig('test guidelines', tmpDir, null);
      
      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('test guidelines');
    });

    it('backs up existing .augment-guidelines file', async () => {
      const target = path.join(tmpDir, '.augment-guidelines');
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

      const configPath = path.join(tmpDir, '.augmentcode', 'config.json');
      const configContent = await fs.readFile(configPath, 'utf8');
      const parsedConfig = JSON.parse(configContent);
      
      expect(parsedConfig.mcpServers).toEqual(mcpConfig.mcpServers);
    });

    it('merges with existing MCP configuration', async () => {
      const configPath = path.join(tmpDir, '.augmentcode', 'config.json');
      const existingConfig = {
        mcpServers: {
          existing: {
            command: 'existing-command',
            args: ['existing-arg']
          }
        },
        otherSettings: {
          value: 'preserved'
        }
      };

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));

      const newMcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
          }
        }
      };

      await agent.applyRulerConfig('test guidelines', tmpDir, newMcpConfig);

      const updatedContent = await fs.readFile(configPath, 'utf8');
      const updatedConfig = JSON.parse(updatedContent);
      
      // Should have both existing and new servers
      expect(updatedConfig.mcpServers.existing).toEqual(existingConfig.mcpServers.existing);
      expect(updatedConfig.mcpServers.filesystem).toEqual(newMcpConfig.mcpServers.filesystem);
      expect(updatedConfig.otherSettings).toEqual(existingConfig.otherSettings);
    });

    it('uses overwrite strategy when specified', async () => {
      const configPath = path.join(tmpDir, '.augmentcode', 'config.json');
      const existingConfig = {
        mcpServers: {
          existing: {
            command: 'existing-command'
          }
        }
      };

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));

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

      const updatedContent = await fs.readFile(configPath, 'utf8');
      const updatedConfig = JSON.parse(updatedContent);
      
      // Should only have new servers, existing should be gone
      expect(updatedConfig.mcpServers.existing).toBeUndefined();
      expect(updatedConfig.mcpServers.filesystem).toEqual(newMcpConfig.mcpServers.filesystem);
    });
  });
});