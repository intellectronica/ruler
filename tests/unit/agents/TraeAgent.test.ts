import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';
import { TraeAgent } from '../../../src/agents/TraeAgent';

describe('TraeAgent', () => {
  let tmpDir: string;
  let agent: TraeAgent;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-trae-'));
    agent = new TraeAgent();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('agent properties', () => {
    it('returns correct identifier', () => {
      expect(agent.getIdentifier()).toBe('trae');
    });

    it('returns correct name', () => {
      expect(agent.getName()).toBe('Trae AI');
    });

    it('returns correct default output path', () => {
      const expected = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });

    it('returns that MCP is not supported', () => {
      expect(agent.supportsMcpStdio()).toBe(false);
      expect(agent.supportsMcpRemote()).toBe(false);
    });
  });

  describe('applyRulerConfig', () => {
    it('creates project_rules.md file', async () => {
      const target = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      await agent.applyRulerConfig('test guidelines', tmpDir, null);

      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('test guidelines');
    });

    it('backs up existing project_rules.md file', async () => {
      const target = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
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

      // Only the rules file should be created, no additional MCP configuration
      const rulesPath = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      
      const rulesContent = await fs.readFile(rulesPath, 'utf8');
      expect(rulesContent).toBe('test guidelines');
      
      // No additional files should be created since Trae doesn't support MCP
      const traeDir = path.join(tmpDir, '.trae');
      const traeContents = await fs.readdir(traeDir, { recursive: true });
      expect(traeContents).toEqual(['rules', 'rules/project_rules.md']);
    });

    it('creates nested directory structure', async () => {
      await agent.applyRulerConfig('nested test', tmpDir, null);

      const target = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('nested test');

      // Verify directory structure was created
      const stats = await fs.stat(path.dirname(target));
      expect(stats.isDirectory()).toBe(true);
    });

    it('handles empty content', async () => {
      const target = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      await agent.applyRulerConfig('', tmpDir, null);

      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('');
    });

    it('overwrites existing content', async () => {
      const target = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'original content');

      await agent.applyRulerConfig('updated content', tmpDir, null);

      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('updated content');
    });

    it('supports disabling backup', async () => {
      const target = path.join(tmpDir, '.trae', 'rules', 'project_rules.md');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'original content');

      await agent.applyRulerConfig('new content', tmpDir, null, undefined, false);

      const content = await fs.readFile(target, 'utf8');
      expect(content).toBe('new content');

      // Backup should not exist
      try {
        await fs.access(`${target}.bak`);
        fail('Backup file should not exist when backup is disabled');
      } catch (error: unknown) {
        expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });
});