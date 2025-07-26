import { GooseAgent } from '../../../src/agents/GooseAgent';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('GooseAgent', () => {
  let agent: GooseAgent;
  let tmpDir: string;

  beforeEach(async () => {
    agent = new GooseAgent();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'goose-agent-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should have correct identifier', () => {
    expect(agent.getIdentifier()).toBe('goose');
  });

  it('should have correct name', () => {
    expect(agent.getName()).toBe('Goose');
  });

  it('should return correct default output path', () => {
    const outputPath = agent.getDefaultOutputPath('/test/project');
    expect(outputPath).toBe('/test/project/.goosehints');
  });

  it('should write rules to .goosehints file', async () => {
    const rules = 'Test instructions for Goose';
    await agent.applyRulerConfig(rules, tmpDir, null);
    
    const hintsPath = path.join(tmpDir, '.goosehints');
    const content = await fs.readFile(hintsPath, 'utf8');
    expect(content).toBe(rules);
  });

  it('should ignore MCP configuration since Goose does not support local config files', async () => {
    const rules = 'Test instructions for Goose';
    const mcpConfig = {
      mcpServers: {
        testServer: {
          url: 'https://test-server.example.com',
          timeout: 300,
          env: {
            API_KEY: '${TEST_API_KEY}'
          }
        }
      }
    };
    
    await agent.applyRulerConfig(rules, tmpDir, mcpConfig);
    
    // Should only create .goosehints file
    const hintsPath = path.join(tmpDir, '.goosehints');
    const content = await fs.readFile(hintsPath, 'utf8');
    expect(content).toBe(rules);
    
    // Should not create any config files
    const configPath = path.join(tmpDir, '.goose', 'config.yaml');
    await expect(fs.access(configPath)).rejects.toThrow();
  });

  it('should return empty string for MCP server key since MCP is not supported', () => {
    expect(agent.getMcpServerKey()).toBe('');
  });
});