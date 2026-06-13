import { OpenCodeAgent } from '../../../src/agents/OpenCodeAgent';
import * as fs from 'fs/promises';
import { writeGeneratedFile } from '../../../src/core/FileSystemUtils';

// Mock fs module
jest.mock('fs/promises');
jest.mock('../../../src/core/FileSystemUtils', () => ({
  backupFile: jest.fn(),
  writeGeneratedFile: jest.fn(),
}));

const mockedFs = jest.mocked(fs);
const mockedWriteGeneratedFile = jest.mocked(writeGeneratedFile);

describe('OpenCodeAgent', () => {
  let agent: OpenCodeAgent;

  beforeEach(() => {
    agent = new OpenCodeAgent();
    jest.clearAllMocks();
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('opencode');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('OpenCode');
  });

  it('should return the correct default output paths', () => {
    const paths = agent.getDefaultOutputPath('/root');
    expect(paths.instructions).toBe('/root/AGENTS.md');
    expect(paths.mcp).toBe('/root/opencode.json');
  });

  it('should support MCP stdio', () => {
    expect(agent.supportsMcpStdio()).toBe(true);
  });

  it('should support MCP remote', () => {
    expect(agent.supportsMcpRemote()).toBe(true);
  });

  it('should support native skills', () => {
    expect(agent.supportsNativeSkills()).toBe(true);
  });

  it('should write only instructions when no MCP config is provided', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('File not found'));

    await agent.applyRulerConfig('rules', '/root', null);

    expect(mockedWriteGeneratedFile).toHaveBeenCalledWith(
      '/root/AGENTS.md',
      'rules',
    );
    expect(mockedWriteGeneratedFile).toHaveBeenCalledTimes(1);
  });

  it('should create opencode.json with MCP servers when MCP config provided', async () => {
    const mcpConfig = {
      mcpServers: {
        'test-server': {
          command: 'echo',
          args: ['hello'],
        },
      },
    };

    mockedFs.readFile.mockRejectedValue(new Error('File not found'));

    await agent.applyRulerConfig('rules', '/root', mcpConfig);

    expect(mockedWriteGeneratedFile).toHaveBeenCalledWith(
      '/root/AGENTS.md',
      'rules',
    );
    expect(mockedWriteGeneratedFile).toHaveBeenCalledWith(
      '/root/opencode.json',
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          mcp: {
            'test-server': {
              command: 'echo',
              args: ['hello'],
            },
          },
        },
        null,
        2,
      ),
    );
  });

  it('should apply ruler config to custom paths from agent config', async () => {
    const mcpConfig = {
      mcpServers: {
        'test-server': {
          command: 'echo',
          args: ['hello'],
        },
      },
    };

    mockedFs.readFile.mockRejectedValue(new Error('File not found'));

    await agent.applyRulerConfig('rules', '/root', mcpConfig, {
      outputPathInstructions: 'CUSTOM.md',
      outputPathConfig: 'custom-opencode.json',
    });

    expect(mockedWriteGeneratedFile).toHaveBeenCalledWith(
      '/root/CUSTOM.md',
      'rules',
    );
    expect(mockedWriteGeneratedFile).toHaveBeenCalledWith(
      '/root/custom-opencode.json',
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          mcp: {
            'test-server': {
              command: 'echo',
              args: ['hello'],
            },
          },
        },
        null,
        2,
      ),
    );
  });

  it('should use outputPath as the instructions path when provided', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('File not found'));

    await agent.applyRulerConfig('rules', '/root', null, {
      outputPath: 'CUSTOM.md',
      outputPathInstructions: 'IGNORED.md',
    });

    expect(mockedWriteGeneratedFile).toHaveBeenCalledWith(
      '/root/CUSTOM.md',
      'rules',
    );
  });
});
