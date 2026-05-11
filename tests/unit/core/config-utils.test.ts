import { mapRawAgentConfigs } from '../../../src/core/config-utils';
import { IAgent, IAgentConfig } from '../../../src/agents/IAgent';

// Mock agents for testing
class MockAgent implements IAgent {
  constructor(
    private identifier: string,
    private name: string
  ) {}

  getIdentifier(): string {
    return this.identifier;
  }

  getName(): string {
    return this.name;
  }

  applyRulerConfig(): Promise<void> {
    return Promise.resolve();
  }

  getDefaultOutputPath(): string {
    return '';
  }
}

describe('config-utils', () => {
  describe('mapRawAgentConfigs', () => {
    let mockAgents: IAgent[];

    beforeEach(() => {
      mockAgents = [
        new MockAgent('copilot', 'GitHub Copilot'),
        new MockAgent('claude', 'Claude Code'),
        new MockAgent('cursor', 'Cursor'),
        new MockAgent('aider', 'Aider'),
        new MockAgent('augmentcode', 'AugmentCode'),
      ];
    });

    it('should map exact identifier matches (case-insensitive)', () => {
      const rawConfigs = {
        copilot: { enabled: true },
        CLAUDE: { enabled: false },
        CuRsOr: { outputPath: '/custom/path' },
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      expect(result).toEqual({
        copilot: { enabled: true },
        claude: { enabled: false },
        cursor: { outputPath: '/custom/path' },
      });
    });

    it('should map substring matches with display names (case-insensitive)', () => {
      const rawConfigs = {
        github: { enabled: true }, // matches "GitHub Copilot"
        code: { enabled: false },  // matches "Claude Code" and "AugmentCode" 
        augment: { outputPath: '/path' }, // matches "AugmentCode"
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      expect(result).toEqual({
        copilot: { enabled: true },
        claude: { enabled: false },
        augmentcode: { outputPath: '/path' }, // Note: both claude and augmentcode would match 'code', but augmentcode comes later
      });
    });

    it('should handle mixed exact and substring matches', () => {
      const rawConfigs = {
        copilot: { enabled: true }, // exact match
        github: { enabled: false }, // substring match with same agent
        claude: { outputPath: '/claude' }, // exact match  
        code: { outputPath: '/code' }, // substring match (different agent)
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      // copilot should get both configs, but the last one wins
      // claude should get both configs, but the last one wins
      expect(result.copilot).toBeDefined();
      expect(result.claude).toBeDefined();
      expect(Object.keys(result)).toContain('copilot');
      expect(Object.keys(result)).toContain('claude');
    });

    it('should ignore keys that do not match any agent', () => {
      const rawConfigs = {
        copilot: { enabled: true },
        nonexistent: { enabled: false },
        invalid_agent: { outputPath: '/path' },
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      expect(result).toEqual({
        copilot: { enabled: true },
      });
    });

    it('should handle empty raw configs', () => {
      const rawConfigs = {};

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      expect(result).toEqual({});
    });

    it('should handle empty agents array', () => {
      const rawConfigs = {
        copilot: { enabled: true },
        claude: { enabled: false },
      };

      const result = mapRawAgentConfigs(rawConfigs, []);

      expect(result).toEqual({});
    });

    it('should handle case sensitivity properly', () => {
      const rawConfigs = {
        GITHUB: { enabled: true }, // should match "GitHub Copilot"
        github: { enabled: false }, // should also match "GitHub Copilot"
        GitHuB: { outputPath: '/path' }, // should also match "GitHub Copilot"
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      expect(result.copilot).toBeDefined();
      expect(Object.keys(result)).toEqual(['copilot']);
    });

    it('should handle multiple keys mapping to the same agent', () => {
      const rawConfigs = {
        copilot: { enabled: true },
        github: { enabled: false, outputPath: '/github' },
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      // The second match should overwrite the first
      expect(result.copilot).toEqual({ enabled: false, outputPath: '/github' });
    });

    it('should preserve all config properties', () => {
      const rawConfigs = {
        copilot: {
          enabled: true,
          outputPath: '/custom/path',
          outputPathInstructions: '/instructions',
          outputPathConfig: '/config',
          mcp: { enabled: false }
        },
      };

      const result = mapRawAgentConfigs(rawConfigs, mockAgents);

      expect(result.copilot).toEqual({
        enabled: true,
        outputPath: '/custom/path',
        outputPathInstructions: '/instructions',
        outputPathConfig: '/config',
        mcp: { enabled: false }
      });
    });

    it('should handle partial substring matches correctly', () => {
      const mockAgentWithLongerName = new MockAgent('test', 'Test Agent With Long Name');
      const agents = [mockAgentWithLongerName];
      
      const rawConfigs = {
        agent: { enabled: true }, // should match "Test Agent With Long Name"
        long: { enabled: false }, // should also match
        name: { outputPath: '/path' }, // should also match
        xyz: { enabled: true }, // should not match
      };

      const result = mapRawAgentConfigs(rawConfigs, agents);

      expect(result.test).toBeDefined();
      expect(Object.keys(result)).toEqual(['test']);
    });
  });
});