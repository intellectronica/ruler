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

    it('returns that MCP is not supported', () => {
      expect(agent.supportsMcpStdio()).toBe(false);
      expect(agent.supportsMcpRemote()).toBe(false);
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

    it('ignores MCP configuration when provided', async () => {
      const mcpConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir]
          }
        }
      };

      await agent.applyRulerConfig('test guidelines', tmpDir, mcpConfig);

      // Only the instructions file should be created, no VSCode settings
      const instructionsPath = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      const settingsPath = path.join(tmpDir, '.vscode', 'settings.json');
      
      const instructionsContent = await fs.readFile(instructionsPath, 'utf8');
      expect(instructionsContent).toBe('test guidelines');
      
      // VSCode settings should not be created since AugmentCode doesn't support MCP
      try {
        await fs.access(settingsPath);
        fail('VSCode settings file should not have been created');
      } catch (error: unknown) {
        expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });

    it('ignores existing MCP configuration and merge requests', async () => {
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

      // Check that the instructions file was created
      const instructionsPath = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      const instructionsContent = await fs.readFile(instructionsPath, 'utf8');
      expect(instructionsContent).toBe('test guidelines');

      // Check that existing VSCode settings were not modified (AugmentCode doesn't support MCP)
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      const parsedSettings = JSON.parse(settingsContent);
      expect(parsedSettings).toEqual(existingSettings);
    });

    it('ignores overwrite strategy when specified (no MCP support)', async () => {
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

      // Check that the instructions file was created
      const instructionsPath = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      const instructionsContent = await fs.readFile(instructionsPath, 'utf8');
      expect(instructionsContent).toBe('test guidelines');

      // Check that existing VSCode settings were not modified (AugmentCode doesn't support MCP)
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      const parsedSettings = JSON.parse(settingsContent);
      expect(parsedSettings).toEqual(existingSettings);
    });
  });
});