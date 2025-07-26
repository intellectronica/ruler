import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { GooseAgent } from '../../../src/agents/GooseAgent';

describe('GooseAgent', () => {
  let tmpDir: string;
  let agent: GooseAgent;
  
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'goose-agent-'));
    agent = new GooseAgent();
  });
  
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
  
  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('goose');
  });
  
  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Goose');
  });
  
  it('should return the correct default output paths', () => {
    const expected = {
      hints: path.join(tmpDir, '.goosehints'),
      config: path.join(tmpDir, '.goose', 'config.yaml')
    };
    expect(agent.getDefaultOutputPath(tmpDir)).toEqual(expected);
  });
  
  it('should write rules to .goosehints file', async () => {
    const rules = 'Test instructions for Goose';
    await agent.applyRulerConfig(rules, tmpDir, null);
    
    const hintsPath = path.join(tmpDir, '.goosehints');
    const content = await fs.readFile(hintsPath, 'utf8');
    expect(content).toBe(rules);
  });
  
  it('should create config.yaml with default settings when no MCP config exists', async () => {
    const rules = 'Test instructions for Goose';
    await agent.applyRulerConfig(rules, tmpDir, null);
    
    const configPath = path.join(tmpDir, '.goose', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(content) as Record<string, unknown>;
    
    expect(config).toHaveProperty('GOOSE_PROVIDER');
    expect(config).toHaveProperty('GOOSE_MODEL');
    expect(config).toHaveProperty('extensions');
  });
  
  it('should merge MCP configuration into config.yaml', async () => {
    const rules = 'Test instructions for Goose';
    const mcpConfig = {
      mcpServers: {
        testServer: {
          enabled: true,
          type: 'remote',
          url: 'https://test-server.example.com',
          timeout: 300,
          envs: {
            API_KEY: '${TEST_API_KEY}'
          }
        }
      }
    };
    
    await agent.applyRulerConfig(rules, tmpDir, mcpConfig);
    
    const configPath = path.join(tmpDir, '.goose', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(content) as Record<string, unknown>;
    
    expect(config).toHaveProperty('extensions.testServer');
    const testServer = (config.extensions as Record<string, unknown>).testServer as Record<string, unknown>;
    expect(testServer).toHaveProperty('enabled', true);
    expect(testServer).toHaveProperty('type', 'remote');
    expect(testServer).toHaveProperty('url', 'https://test-server.example.com');
  });
  
  it('should respect the MCP strategy when merging configurations', async () => {
    // First create an existing config
    const configDir = path.join(tmpDir, '.goose');
    await fs.mkdir(configDir, { recursive: true });
    
    const existingConfig = {
      GOOSE_PROVIDER: 'anthropic',
      GOOSE_MODEL: 'claude-3',
      extensions: {
        existingServer: {
          enabled: true,
          type: 'stdio',
          cmd: 'existing-cmd',
          args: ['arg1', 'arg2'],
          timeout: 200
        }
      }
    };
    
    await fs.writeFile(
      path.join(configDir, 'config.yaml'),
      yaml.dump(existingConfig)
    );
    
    // Apply new MCP config with merge strategy
    const rules = 'Test instructions for Goose';
    const mcpConfig = {
      mcpServers: {
        newServer: {
          enabled: true,
          type: 'remote',
          url: 'https://new-server.example.com'
        }
      }
    };
    
    await agent.applyRulerConfig(rules, tmpDir, mcpConfig, {
      mcp: { strategy: 'merge' }
    });
    
    const configPath = path.join(tmpDir, '.goose', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(content) as Record<string, unknown>;
    
    // Should have both servers
    expect(config).toHaveProperty('extensions.existingServer');
    expect(config).toHaveProperty('extensions.newServer');
    
    // Should preserve original provider and model
    expect(config).toHaveProperty('GOOSE_PROVIDER', 'anthropic');
    expect(config).toHaveProperty('GOOSE_MODEL', 'claude-3');
  });
  
  it('should use overwrite strategy when specified', async () => {
    // First create an existing config
    const configDir = path.join(tmpDir, '.goose');
    await fs.mkdir(configDir, { recursive: true });
    
    const existingConfig = {
      GOOSE_PROVIDER: 'anthropic',
      GOOSE_MODEL: 'claude-3',
      extensions: {
        existingServer: {
          enabled: true,
          type: 'stdio',
          cmd: 'existing-cmd'
        }
      }
    };
    
    await fs.writeFile(
      path.join(configDir, 'config.yaml'),
      yaml.dump(existingConfig)
    );
    
    // Apply new MCP config with overwrite strategy
    const rules = 'Test instructions for Goose';
    const mcpConfig = {
      mcpServers: {
        newServer: {
          enabled: true,
          type: 'remote',
          url: 'https://new-server.example.com'
        }
      }
    };
    
    await agent.applyRulerConfig(rules, tmpDir, mcpConfig, {
      mcp: { strategy: 'overwrite' }
    });
    
    const configPath = path.join(tmpDir, '.goose', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(content) as Record<string, unknown>;
    
    // Should only have the new server
    expect(config.extensions).toHaveProperty('newServer');
    expect((config.extensions as Record<string, unknown>)).not.toHaveProperty('existingServer');
    
    // Should preserve original provider and model
    expect(config).toHaveProperty('GOOSE_PROVIDER', 'anthropic');
    expect(config).toHaveProperty('GOOSE_MODEL', 'claude-3');
  });
});