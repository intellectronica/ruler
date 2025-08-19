import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';

// Concrete implementation of AbstractAgent for testing
class TestAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'test';
  }

  getName(): string {
    return 'Test Agent';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'TEST.md');
  }
}

describe('AbstractAgent', () => {
  let tmpDir: string;
  let agent: TestAgent;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abstract-agent-'));
    agent = new TestAgent();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('agent properties', () => {
    it('returns correct identifier', () => {
      expect(agent.getIdentifier()).toBe('test');
    });

    it('returns correct name', () => {
      expect(agent.getName()).toBe('Test Agent');
    });

    it('returns correct default output path', () => {
      const expected = path.join(tmpDir, 'TEST.md');
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });

    it('returns default MCP server key', () => {
      expect(agent.getMcpServerKey?.()).toBe('mcpServers');
    });
  });

  describe('applyRulerConfig', () => {
    it('writes rules to default output path', async () => {
      const rules = 'Test rules for agent';
      await agent.applyRulerConfig(rules, tmpDir, null);

      const outputPath = path.join(tmpDir, 'TEST.md');
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toBe(rules);
    });

    it('creates parent directory if it does not exist', async () => {
      const rules = 'Test rules with nested path';
      const customPath = path.join('nested', 'dir', 'test.md');
      
      await agent.applyRulerConfig(rules, tmpDir, null, { outputPath: customPath });

      const fullPath = path.join(tmpDir, customPath);
      const content = await fs.readFile(fullPath, 'utf8');
      expect(content).toBe(rules);
    });

    it('backs up existing file', async () => {
      // Create existing file
      const outputPath = path.join(tmpDir, 'TEST.md');
      const existingContent = 'Existing test rules';
      await fs.writeFile(outputPath, existingContent);

      // Apply new rules
      const newRules = 'New test rules';
      await agent.applyRulerConfig(newRules, tmpDir, null);

      // Check backup was created
      const backupPath = `${outputPath}.bak`;
      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe(existingContent);

      // Check new content was written
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toBe(newRules);
    });

    it('uses custom output path when provided', async () => {
      const rules = 'Custom path rules';
      const customPath = path.join(tmpDir, 'custom', 'test-rules.md');
      await fs.mkdir(path.dirname(customPath), { recursive: true });
      
      await agent.applyRulerConfig(rules, tmpDir, null, { outputPath: customPath });
      
      const content = await fs.readFile(customPath, 'utf8');
      expect(content).toBe(rules);
    });

    it('resolves relative paths correctly', async () => {
      const rules = 'Relative path rules';
      const relativePath = '../outside/test.md';
      
      // This should resolve relative to the project root
      await agent.applyRulerConfig(rules, tmpDir, null, { outputPath: relativePath });
      
      const expectedPath = path.resolve(tmpDir, relativePath);
      const content = await fs.readFile(expectedPath, 'utf8');
      expect(content).toBe(rules);
    });

    it('handles absolute paths correctly', async () => {
      const rules = 'Absolute path rules';
      const absolutePath = path.join(tmpDir, 'absolute', 'test.md');
      
      await agent.applyRulerConfig(rules, tmpDir, null, { outputPath: absolutePath });
      
      const content = await fs.readFile(absolutePath, 'utf8');
      expect(content).toBe(rules);
    });
  });
});