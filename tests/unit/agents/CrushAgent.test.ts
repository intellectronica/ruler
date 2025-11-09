import { CrushAgent } from '../../../src/agents/CrushAgent';
import { revertAllAgentConfigs } from '../../../src/revert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('CrushAgent', () => {
  const projectRoot = '/tmp/test-project';
  const agent = new CrushAgent();

  beforeEach(async () => {
    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('crush');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Crush');
  });

  it('should return the correct output paths', () => {
    const outputPaths = agent.getDefaultOutputPath(projectRoot);
    expect(outputPaths).toEqual({
      instructions: path.join(projectRoot, 'CRUSH.md'),
      mcp: path.join(projectRoot, '.crush.json'),
    });
  });

  it('should create CRUSH.md and .crush.json with ruler config', async () => {
    const rules = 'some rules';
    const mcpJson = { mcpServers: { 'test-mcp': { command: 'echo' } } };
    await agent.applyRulerConfig(rules, projectRoot, mcpJson);

    const instructionsPath = path.join(projectRoot, 'CRUSH.md');
    const mcpPath = path.join(projectRoot, '.crush.json');

    const instructionsContent = await fs.readFile(instructionsPath, 'utf-8');
    const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(instructionsContent).toBe(rules);
    expect(mcpContent).toEqual({ mcp: mcpJson.mcpServers });
  });

  it('should update .crush.json with new mcp servers', async () => {
    const initialMcp = {
      mcp: {
        'existing-mcp': { command: 'ls' },
      },
    };
    const mcpPath = path.join(projectRoot, '.crush.json');
    await fs.writeFile(mcpPath, JSON.stringify(initialMcp, null, 2));

    const rules = 'new rules';
    const newMcpJson = { mcpServers: { 'new-mcp': { command: 'pwd' } } };
    await agent.applyRulerConfig(rules, projectRoot, newMcpJson);

    const updatedMcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(updatedMcpContent).toEqual({
      mcp: {
        'existing-mcp': { command: 'ls' },
        'new-mcp': { command: 'pwd' },
      },
    });
  });

  it('should not create .crush.json if no MCP config provided', async () => {
    const rules = 'some rules';
    await agent.applyRulerConfig(rules, projectRoot, null);

    const instructionsPath = path.join(projectRoot, 'CRUSH.md');
    const mcpPath = path.join(projectRoot, '.crush.json');

    const instructionsContent = await fs.readFile(instructionsPath, 'utf-8');
    expect(instructionsContent).toBe(rules);

    // MCP file should not exist when no MCP config is provided
    await expect(fs.access(mcpPath)).rejects.toThrow();
  });

  it('should transform MCP server type from "remote" to "http"', async () => {
    const rules = 'some rules';
    const mcpJson = {
      mcpServers: {
        context7: {
          url: 'https://mcp.context7.com/mcp',
          headers: {
            CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}',
          },
          type: 'remote',
        },
      },
    };
    await agent.applyRulerConfig(rules, projectRoot, mcpJson);

    const mcpPath = path.join(projectRoot, '.crush.json');
    const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(mcpContent).toEqual({
      mcp: {
        context7: {
          url: 'https://mcp.context7.com/mcp',
          headers: {
            CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}',
          },
          type: 'http',
        },
      },
    });
  });

  it('should transform MCP server type from "remote" to "sse" for SSE URLs', async () => {
    const rules = 'some rules';
    const mcpJson = {
      mcpServers: {
        'sse-server': {
          url: 'https://example.com/sse/endpoint',
          type: 'remote',
        },
      },
    };
    await agent.applyRulerConfig(rules, projectRoot, mcpJson);

    const mcpPath = path.join(projectRoot, '.crush.json');
    const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(mcpContent).toEqual({
      mcp: {
        'sse-server': {
          url: 'https://example.com/sse/endpoint',
          type: 'sse',
        },
      },
    });
  });

  it('should preserve non-remote MCP server types', async () => {
    const rules = 'some rules';
    const mcpJson = {
      mcpServers: {
        'local-server': {
          command: 'echo',
          type: 'stdio',
        },
      },
    };
    await agent.applyRulerConfig(rules, projectRoot, mcpJson);

    const mcpPath = path.join(projectRoot, '.crush.json');
    const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(mcpContent).toEqual({
      mcp: {
        'local-server': {
          command: 'echo',
          type: 'stdio',
        },
      },
    });
  });

  describe('backup and revert functionality', () => {
    let tmpDir: string;
    let testAgent: CrushAgent;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crush-agent-test-'));
      testAgent = new CrushAgent();
      
      // Create .ruler directory for revert functionality
      const rulerDir = path.join(tmpDir, '.ruler');
      await fs.mkdir(rulerDir, { recursive: true });
      await fs.writeFile(path.join(rulerDir, 'instructions.md'), 'Test rules');
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should be properly reverted by revertAllAgentConfigs', async () => {
      const rules = 'Crush agent rules';
      const mcpJson = { mcpServers: { 'test-server': { command: 'echo' } } };
      
      await testAgent.applyRulerConfig(rules, tmpDir, mcpJson);
      
      const instructionsPath = path.join(tmpDir, 'CRUSH.md');
      const mcpPath = path.join(tmpDir, '.crush.json');
      
      // Verify files exist
      await expect(fs.access(instructionsPath)).resolves.toBeUndefined();
      await expect(fs.access(mcpPath)).resolves.toBeUndefined();
      
      // Revert crush agent
      await revertAllAgentConfigs(tmpDir, ['crush'], undefined, false, false, false);
      
      // Verify both files are removed
      await expect(fs.access(instructionsPath)).rejects.toThrow();
      await expect(fs.access(mcpPath)).rejects.toThrow();
    });

    it('should restore both files from backup when revert is called', async () => {
      const instructionsPath = path.join(tmpDir, 'CRUSH.md');
      const mcpPath = path.join(tmpDir, '.crush.json');
      const instructionsBackup = `${instructionsPath}.bak`;
      const mcpBackup = `${mcpPath}.bak`;
      
      const originalInstructions = 'Original Crush instructions';
      const originalMcp = { mcp: { 'original-server': { command: 'ls' } } };
      const newInstructions = 'New Crush rules';
      const newMcp = { mcp: { 'new-server': { command: 'pwd' } } };
      
      // Create original files and backups
      await fs.writeFile(instructionsPath, originalInstructions);
      await fs.writeFile(mcpPath, JSON.stringify(originalMcp, null, 2));
      await fs.writeFile(instructionsBackup, originalInstructions);
      await fs.writeFile(mcpBackup, JSON.stringify(originalMcp, null, 2));
      
      // Overwrite with new content (simulating ruler apply)
      await fs.writeFile(instructionsPath, newInstructions);
      await fs.writeFile(mcpPath, JSON.stringify(newMcp, null, 2));
      
      // Verify new content is in place
      expect(await fs.readFile(instructionsPath, 'utf8')).toBe(newInstructions);
      expect(JSON.parse(await fs.readFile(mcpPath, 'utf8'))).toEqual(newMcp);
      
      // Revert
      await revertAllAgentConfigs(tmpDir, ['crush'], undefined, false, false, false);
      
      // Verify original content is restored
      const restoredInstructions = await fs.readFile(instructionsPath, 'utf8');
      const restoredMcp = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
      
      expect(restoredInstructions).toBe(originalInstructions);
      expect(restoredMcp).toEqual(originalMcp);
      
      // Verify backups are cleaned up (default behavior)
      await expect(fs.access(instructionsBackup)).rejects.toThrow();
      await expect(fs.access(mcpBackup)).rejects.toThrow();
    });

    it('should handle custom output paths correctly', async () => {
      const customInstructionsPath = 'custom-crush-instructions.md';
      const customMcpPath = 'custom-crush.json';
      const rules = 'Custom rules';
      const mcpJson = { mcpServers: { 'custom-server': { command: 'echo' } } };
      
      const customInstructionsFullPath = path.join(tmpDir, customInstructionsPath);
      const customMcpFullPath = path.join(tmpDir, customMcpPath);
      
      await testAgent.applyRulerConfig(rules, tmpDir, mcpJson, {
        outputPathInstructions: customInstructionsFullPath,
        outputPathConfig: customMcpFullPath
      });
      
      const instructionsContent = await fs.readFile(customInstructionsFullPath, 'utf8');
      const mcpContent = JSON.parse(await fs.readFile(customMcpFullPath, 'utf8'));
      
      expect(instructionsContent).toBe(rules);
      expect(mcpContent).toEqual({ mcp: mcpJson.mcpServers });
    });

    it('should properly merge existing MCP configuration', async () => {
      const mcpPath = path.join(tmpDir, '.crush.json');
      
      // Create existing MCP config
      const existingMcp = {
        mcp: {
          'existing-server': { command: 'ls' }
        }
      };
      await fs.writeFile(mcpPath, JSON.stringify(existingMcp, null, 2));
      
      // Apply new config
      const rules = 'rules';
      const newMcpJson = { mcpServers: { 'new-server': { command: 'pwd' } } };
      await testAgent.applyRulerConfig(rules, tmpDir, newMcpJson);
      
      // Verify merged result
      const mergedMcp = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
      expect(mergedMcp).toEqual({
        mcp: {
          'existing-server': { command: 'ls' },
          'new-server': { command: 'pwd' }
        }
      });
    });
  });
});
