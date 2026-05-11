import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { getAgentOutputPaths } from '../../../src/agents/agent-utils';
import { IAgent, IAgentConfig } from '../../../src/agents/IAgent';

// Mock agent classes for testing
class MockSinglePathAgent implements IAgent {
  getIdentifier(): string {
    return 'mock-single';
  }

  getName(): string {
    return 'Mock Single Path Agent';
  }

  async applyRulerConfig(): Promise<void> {
    // Mock implementation
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'MOCK.md');
  }
}

class MockMultiPathAgent implements IAgent {
  getIdentifier(): string {
    return 'mock-multi';
  }

  getName(): string {
    return 'Mock Multi Path Agent';
  }

  async applyRulerConfig(): Promise<void> {
    // Mock implementation
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'mock_instructions.md'),
      config: path.join(projectRoot, '.mock.conf.yml'),
      extra: path.join(projectRoot, 'extra.txt'),
    };
  }
}

describe('getAgentOutputPaths', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-agent-utils-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Single path agents', () => {
    it('returns default path when no config is provided', () => {
      const agent = new MockSinglePathAgent();
      const result = getAgentOutputPaths(agent, tmpDir);
      
      expect(result).toEqual([path.join(tmpDir, 'MOCK.md')]);
    });

    it('returns custom outputPath when provided in config', () => {
      const agent = new MockSinglePathAgent();
      const agentConfig: IAgentConfig = {
        outputPath: '/custom/path/output.md',
      };
      
      const result = getAgentOutputPaths(agent, tmpDir, agentConfig);
      
      expect(result).toEqual(['/custom/path/output.md']);
    });

    it('ignores other config properties for single path agents', () => {
      const agent = new MockSinglePathAgent();
      const agentConfig: IAgentConfig = {
        outputPath: '/custom/path/output.md',
        outputPathInstructions: '/ignored/instructions.md',
        outputPathConfig: '/ignored/config.yml',
      };
      
      const result = getAgentOutputPaths(agent, tmpDir, agentConfig);
      
      expect(result).toEqual(['/custom/path/output.md']);
    });
  });

  describe('Multi-path agents', () => {
    it('returns all default paths when no config is provided', () => {
      const agent = new MockMultiPathAgent();
      const result = getAgentOutputPaths(agent, tmpDir);
      
      expect(result).toEqual([
        path.join(tmpDir, 'mock_instructions.md'),
        path.join(tmpDir, '.mock.conf.yml'),
        path.join(tmpDir, 'extra.txt'),
      ]);
    });

    it('uses custom outputPathInstructions when provided', () => {
      const agent = new MockMultiPathAgent();
      const agentConfig: IAgentConfig = {
        outputPathInstructions: '/custom/instructions.md',
      };
      
      const result = getAgentOutputPaths(agent, tmpDir, agentConfig);
      
      expect(result).toEqual([
        '/custom/instructions.md',
        path.join(tmpDir, '.mock.conf.yml'),
        path.join(tmpDir, 'extra.txt'),
      ]);
    });

    it('uses custom outputPathConfig when provided', () => {
      const agent = new MockMultiPathAgent();
      const agentConfig: IAgentConfig = {
        outputPathConfig: '/custom/config.yml',
      };
      
      const result = getAgentOutputPaths(agent, tmpDir, agentConfig);
      
      expect(result).toEqual([
        path.join(tmpDir, 'mock_instructions.md'),
        '/custom/config.yml',
        path.join(tmpDir, 'extra.txt'),
      ]);
    });

    it('uses both custom instruction and config paths when provided', () => {
      const agent = new MockMultiPathAgent();
      const agentConfig: IAgentConfig = {
        outputPathInstructions: '/custom/instructions.md',
        outputPathConfig: '/custom/config.yml',
      };
      
      const result = getAgentOutputPaths(agent, tmpDir, agentConfig);
      
      expect(result).toEqual([
        '/custom/instructions.md',
        '/custom/config.yml',
        path.join(tmpDir, 'extra.txt'),
      ]);
    });

    it('handles agent with no instructions path', () => {
      class MockNoInstructionsAgent implements IAgent {
        getIdentifier(): string {
          return 'mock-no-instructions';
        }

        getName(): string {
          return 'Mock No Instructions Agent';
        }

        async applyRulerConfig(): Promise<void> {
          // Mock implementation
        }

        getDefaultOutputPath(projectRoot: string): Record<string, string> {
          return {
            config: path.join(projectRoot, '.mock.conf.yml'),
            other: path.join(projectRoot, 'other.txt'),
          };
        }
      }

      const agent = new MockNoInstructionsAgent();
      const result = getAgentOutputPaths(agent, tmpDir);
      
      expect(result).toEqual([
        path.join(tmpDir, '.mock.conf.yml'),
        path.join(tmpDir, 'other.txt'),
      ]);
    });

    it('handles agent with no config path', () => {
      class MockNoConfigAgent implements IAgent {
        getIdentifier(): string {
          return 'mock-no-config';
        }

        getName(): string {
          return 'Mock No Config Agent';
        }

        async applyRulerConfig(): Promise<void> {
          // Mock implementation
        }

        getDefaultOutputPath(projectRoot: string): Record<string, string> {
          return {
            instructions: path.join(projectRoot, 'instructions.md'),
            other: path.join(projectRoot, 'other.txt'),
          };
        }
      }

      const agent = new MockNoConfigAgent();
      const result = getAgentOutputPaths(agent, tmpDir);
      
      expect(result).toEqual([
        path.join(tmpDir, 'instructions.md'),
        path.join(tmpDir, 'other.txt'),
      ]);
    });

    it('ignores outputPath for multi-path agents', () => {
      const agent = new MockMultiPathAgent();
      const agentConfig: IAgentConfig = {
        outputPath: '/ignored/path.md',
        outputPathInstructions: '/custom/instructions.md',
      };
      
      const result = getAgentOutputPaths(agent, tmpDir, agentConfig);
      
      expect(result).toEqual([
        '/custom/instructions.md',
        path.join(tmpDir, '.mock.conf.yml'),
        path.join(tmpDir, 'extra.txt'),
      ]);
    });
  });

  describe('Edge cases', () => {
    it('handles empty multi-path object', () => {
      class MockEmptyPathsAgent implements IAgent {
        getIdentifier(): string {
          return 'mock-empty';
        }

        getName(): string {
          return 'Mock Empty Paths Agent';
        }

        async applyRulerConfig(): Promise<void> {
          // Mock implementation
        }

        getDefaultOutputPath(): Record<string, string> {
          return {};
        }
      }

      const agent = new MockEmptyPathsAgent();
      const result = getAgentOutputPaths(agent, tmpDir);
      
      expect(result).toEqual([]);
    });
  });
});