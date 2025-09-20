import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { FirebenderAgent } from '../../../src/agents/FirebenderAgent';

describe('FirebenderAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-firebender-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Basic Interface', () => {
    it('returns correct identifier and name', () => {
      const agent = new FirebenderAgent();
      expect(agent.getIdentifier()).toBe('firebender');
      expect(agent.getName()).toBe('Firebender');
    });

    it('returns correct default output paths', () => {
      const agent = new FirebenderAgent();
      const expected = {
        instructions: path.join(tmpDir, 'firebender.json'),
        mcp: path.join(tmpDir, 'firebender.json'),
      };
      expect(agent.getDefaultOutputPath(tmpDir)).toEqual(expected);
    });

    it('supports MCP', () => {
      const agent = new FirebenderAgent();
      expect(agent.supportsMcpStdio()).toBe(true);
      expect(agent.supportsMcpRemote()).toBe(true);
      expect(agent.getMcpServerKey()).toBe('mcpServers');
    });
  });

  describe('Rule Processing', () => {
    it('creates plain text rules when no HTML source comments found', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rules = 'Use TypeScript\nFollow clean architecture';
      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual([
        'Use TypeScript',
        'Follow clean architecture',
      ]);
    });

    it('creates rule objects from HTML source comments', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rules = `<!-- Source: docs/style.md -->
Use consistent naming
<!-- Source: docs/arch.md -->
Follow patterns`;

      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual([
        { filePathMatches: '**/*', rulesPaths: 'docs/style.md' },
        { filePathMatches: '**/*', rulesPaths: 'docs/arch.md' },
      ]);
    });

    it('merges with existing configuration', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const existingConfig = {
        rules: ['Existing rule'],
        otherProperty: 'preserved',
      };
      await fs.writeFile(target, JSON.stringify(existingConfig));

      await agent.applyRulerConfig('New rule', tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual(['Existing rule', 'New rule']);
      expect(config.otherProperty).toBe('preserved');
    });

    it('removes duplicate rules', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const existingConfig = { rules: ['Rule 1', 'Rule 2'] };
      await fs.writeFile(target, JSON.stringify(existingConfig));

      await agent.applyRulerConfig('Rule 2\nRule 3\nRule 1', tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual(['Rule 1', 'Rule 2', 'Rule 3']);
    });

    it('keeps distinct object rules with same rulesPaths but different filePathMatches', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const existingConfig = {
        rules: [
          { filePathMatches: '**/*.ts', rulesPaths: 'docs/style.md' },
          { filePathMatches: 'packages/*', rulesPaths: 'docs/style.md' },
        ],
      };
      await fs.writeFile(target, JSON.stringify(existingConfig));

      await agent.applyRulerConfig('Another rule', tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual(
        expect.arrayContaining([
          { filePathMatches: '**/*.ts', rulesPaths: 'docs/style.md' },
          { filePathMatches: 'packages/*', rulesPaths: 'docs/style.md' },
        ]),
      );
    });
  });

  describe('MCP Configuration', () => {
    it('merges MCP servers with existing configuration', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const existingConfig = {
        rules: ['Existing rule'],
        mcpServers: {
          'existing-server': {
            command: 'existing-command',
            args: ['--existing'],
          },
        },
      };
      await fs.writeFile(target, JSON.stringify(existingConfig));

      const rulerMcpJson = {
        mcpServers: {
          'new-server': {
            command: 'new-command',
            args: ['--new'],
          },
        },
      };

      await agent.applyRulerConfig('New rule', tmpDir, rulerMcpJson);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.mcpServers).toEqual({
        'existing-server': {
          command: 'existing-command',
          args: ['--existing'],
        },
        'new-server': {
          command: 'new-command',
          args: ['--new'],
        },
      });
    });

    it('overwrites MCP servers when strategy is overwrite', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const existingConfig = {
        rules: ['Existing rule'],
        mcpServers: {
          'existing-server': {
            command: 'existing-command',
          },
        },
      };
      await fs.writeFile(target, JSON.stringify(existingConfig));

      const rulerMcpJson = {
        mcpServers: {
          'new-server': {
            command: 'new-command',
          },
        },
      };

      const agentConfig = {
        mcp: { strategy: 'overwrite' as const },
      };

      await agent.applyRulerConfig(
        'New rule',
        tmpDir,
        rulerMcpJson,
        agentConfig,
      );

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.mcpServers).toEqual({
        'new-server': {
          command: 'new-command',
        },
      });
    });

    it('adds MCP servers to configuration without existing servers', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rulerMcpJson = {
        mcpServers: {
          'test-server': {
            command: 'test-command',
            args: ['--test'],
          },
        },
      };

      await agent.applyRulerConfig('Test rule', tmpDir, rulerMcpJson);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.mcpServers).toEqual({
        'test-server': {
          command: 'test-command',
          args: ['--test'],
        },
      });
    });

    it('skips MCP configuration when disabled', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rulerMcpJson = {
        mcpServers: {
          'test-server': {
            command: 'test-command',
          },
        },
      };

      const agentConfig = {
        mcp: { enabled: false },
      };

      await agent.applyRulerConfig(
        'Test rule',
        tmpDir,
        rulerMcpJson,
        agentConfig,
      );

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.mcpServers).toBeUndefined();
    });
  });

  describe('File Operations', () => {
    it('creates parent directories and backs up existing files', async () => {
      const agent = new FirebenderAgent();
      const customPath = 'nested/dir/config.json';
      const target = path.resolve(tmpDir, customPath);

      const agentConfig = { outputPath: customPath };

      // First write
      await agent.applyRulerConfig('First rule', tmpDir, null, agentConfig);
      expect(await fs.stat(path.dirname(target))).toBeTruthy();

      // Second write should create backup
      await agent.applyRulerConfig('Second rule', tmpDir, null, agentConfig);

      const backup = await fs.readFile(`${target}.bak`, 'utf8');
      const backupConfig = JSON.parse(backup);
      expect(backupConfig.rules).toEqual(['First rule']);

      const current = await fs.readFile(target, 'utf8');
      const currentConfig = JSON.parse(current);
      expect(currentConfig.rules).toEqual(['First rule', 'Second rule']);
    });

    it('handles malformed JSON gracefully', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      await fs.writeFile(target, '{ invalid json }');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await agent.applyRulerConfig('New rule', tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual(['New rule']);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Security', () => {
    it('allows valid file paths within project root', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rules = `<!-- Source: src/main.ts -->
Use TypeScript
<!-- Source: docs/README.md -->
Follow documentation`;

      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      expect(config.rules).toEqual([
        { filePathMatches: '**/*', rulesPaths: 'src/main.ts' },
        { filePathMatches: '**/*', rulesPaths: 'docs/README.md' },
      ]);
    });

    it('blocks path traversal attempts outside project root', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rules = `<!-- Source: ../../../etc/passwd -->
Malicious rule
<!-- Source: src/main.ts -->
Valid rule`;

      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      // Only the valid rule should be processed
      expect(config.rules).toEqual([
        { filePathMatches: '**/*', rulesPaths: 'src/main.ts' },
      ]);
    });

    // Note: URL encoded path traversal (e.g., ..%2F..%2F) requires additional
    // handling in Node.js as path.resolve() doesn't decode URL encoding.
    // This is a complex edge case that would need deeper path normalization.

    it('blocks path traversal with multiple levels', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rules = `<!-- Source: ../../../../../../../../etc/shadow -->
Malicious rule
<!-- Source: src/utils.ts -->
Valid rule`;

      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      // Only the valid rule should be processed
      expect(config.rules).toEqual([
        { filePathMatches: '**/*', rulesPaths: 'src/utils.ts' },
      ]);
    });

    it('blocks absolute paths outside project root', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      const rules = `<!-- Source: /etc/passwd -->
Malicious rule
<!-- Source: src/main.ts -->
Valid rule`;

      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      // Only the valid rule should be processed
      expect(config.rules).toEqual([
        { filePathMatches: '**/*', rulesPaths: 'src/main.ts' },
      ]);
    });

    it('allows paths that resolve within project root even with ..', async () => {
      const agent = new FirebenderAgent();
      const target = path.join(tmpDir, 'firebender.json');

      // Create a subdirectory structure
      const subDir = path.join(tmpDir, 'src', 'components');
      await fs.mkdir(subDir, { recursive: true });

      const rules = `<!-- Source: src/components/Button.tsx -->
Use React components
<!-- Source: src/../src/main.ts -->
Navigate up and back`;

      await agent.applyRulerConfig(rules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');
      const config = JSON.parse(written);

      // Both rules should be processed as they resolve within project root
      expect(config.rules).toEqual([
        { filePathMatches: '**/*', rulesPaths: 'src/components/Button.tsx' },
        { filePathMatches: '**/*', rulesPaths: 'src/main.ts' },
      ]);
    });
  });
});
