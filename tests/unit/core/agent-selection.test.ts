import { resolveSelectedAgents } from '../../../src/core/agent-selection';
import { LoadedConfig } from '../../../src/core/ConfigLoader';
import { IAgent } from '../../../src/agents/IAgent';

// Mock agent implementation for testing
class MockAgent implements IAgent {
  constructor(private name: string, private identifier: string) {}
  
  getIdentifier(): string {
    return this.identifier;
  }
  
  getName(): string {
    return this.name;
  }
  
  async applyRulerConfig(): Promise<void> {
    // Mock implementation
  }
  
  getDefaultOutputPath(): string {
    return `.${this.identifier}/config.json`;
  }
}

describe('resolveSelectedAgents', () => {
  const mockAgents = [
    new MockAgent('Claude Code', 'claude'),
    new MockAgent('GitHub Copilot', 'copilot'),
    new MockAgent('Cursor', 'cursor'),
  ];

  it('should select agents based on CLI filters', () => {
    const config: LoadedConfig = {
      cliAgents: ['claude', 'cursor'],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.getIdentifier())).toEqual(['claude', 'cursor']);
  });

  it('should select agents based on CLI filters using partial name matches', () => {
    const config: LoadedConfig = {
      cliAgents: ['copilot'],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('copilot');
  });

  it('should throw error for invalid CLI agent identifiers', () => {
    const config: LoadedConfig = {
      cliAgents: ['invalid-agent'],
      agentConfigs: {},
    };

    expect(() => resolveSelectedAgents(config, mockAgents)).toThrow(
      'Invalid agent specified: invalid-agent'
    );
  });

  it('should select agents based on default_agents when no CLI filters', () => {
    const config: LoadedConfig = {
      defaultAgents: ['copilot'],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('copilot');
  });

  it('should respect enabled flag in agent configs when using default_agents', () => {
    const config: LoadedConfig = {
      defaultAgents: ['claude', 'copilot'],
      agentConfigs: {
        claude: { enabled: false },
        copilot: { enabled: true },
      },
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('copilot');
  });

  it('should throw error for invalid default_agents', () => {
    const config: LoadedConfig = {
      defaultAgents: ['invalid-default'],
      agentConfigs: {},
    };

    expect(() => resolveSelectedAgents(config, mockAgents)).toThrow(
      'Invalid agent specified in default_agents: invalid-default'
    );
  });

  it('should select all enabled agents when no filters or defaults', () => {
    const config: LoadedConfig = {
      agentConfigs: {
        claude: { enabled: false },
      },
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.getIdentifier()).sort()).toEqual(['copilot', 'cursor']);
  });

  it('should select all agents when no configuration is provided', () => {
    const config: LoadedConfig = {
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(3);
    expect(result.map(a => a.getIdentifier()).sort()).toEqual(['claude', 'copilot', 'cursor']);
  });

  it('should handle CLI agents precedence over default_agents', () => {
    const config: LoadedConfig = {
      cliAgents: ['claude'],
      defaultAgents: ['copilot', 'cursor'],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('claude');
  });

  it('should handle partial name matches in CLI agents', () => {
    const config: LoadedConfig = {
      cliAgents: ['code'], // Should match "Claude Code"
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('claude');
  });

  it('should handle partial name matches in default_agents', () => {
    const config: LoadedConfig = {
      defaultAgents: ['code'], // Should match "Claude Code"
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('claude');
  });

  it('should include agents with explicit enabled=true even when not in default_agents', () => {
    const config: LoadedConfig = {
      defaultAgents: ['claude'], // Only claude is in defaults
      agentConfigs: {
        copilot: { enabled: true }, // Explicitly enabled but not in defaults - should be included
        claude: { enabled: true },  // In defaults and enabled
      },
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.getIdentifier()).sort()).toEqual(['claude', 'copilot']);
  });

  it('should exclude agents with explicit enabled=false even when in default_agents', () => {
    const config: LoadedConfig = {
      defaultAgents: ['claude', 'copilot'], // Both in defaults
      agentConfigs: {
        copilot: { enabled: false }, // Explicitly disabled even though in defaults
      },
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('claude');
  });

  it('should handle explicit disable override in default_agents', () => {
    const config: LoadedConfig = {
      defaultAgents: ['claude', 'copilot'],
      agentConfigs: {
        claude: { enabled: false }, // Explicitly disabled
        copilot: { enabled: undefined }, // Should default to included because in default_agents
      },
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(1);
    expect(result[0].getIdentifier()).toBe('copilot');
  });

  it('should handle case insensitive agent matching', () => {
    const config: LoadedConfig = {
      cliAgents: ['CLAUDE', 'CURSOR'],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.getIdentifier())).toEqual(['claude', 'cursor']);
  });

  it('should handle empty CLI agents array', () => {
    const config: LoadedConfig = {
      cliAgents: [],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(3);
    expect(result.map(a => a.getIdentifier()).sort()).toEqual(['claude', 'copilot', 'cursor']);
  });

  it('should handle empty default agents array', () => {
    const config: LoadedConfig = {
      defaultAgents: [],
      agentConfigs: {},
    };

    const result = resolveSelectedAgents(config, mockAgents);

    expect(result).toHaveLength(3);
    expect(result.map(a => a.getIdentifier()).sort()).toEqual(['claude', 'copilot', 'cursor']);
  });
});