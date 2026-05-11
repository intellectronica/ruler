import { applyAllAgentConfigs } from '../../src/lib';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      ...originalFs.promises,
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockImplementation((path, encoding) => {
        if (path.includes('mcp.json')) {
          return Promise.resolve('{"mcpServers": {}}');
        }
  if (path.includes('AGENTS.md')) {
          return Promise.resolve('# Test Instructions');
        }
        if (path.includes('ruler.toml')) {
          return Promise.resolve('# Test TOML config');
        }
        return Promise.reject(new Error(`File not found: ${path}`));
      }),
      mkdir: jest.fn().mockResolvedValue(undefined),
      access: jest.fn().mockImplementation((path) => {
        if (path.includes('.ruler')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      }),
      readdir: jest.fn().mockImplementation((dir) => {
        if (dir.includes('.ruler')) {
          return Promise.resolve(['AGENTS.md', 'mcp.json', 'ruler.toml']);
        }
        return Promise.resolve([]);
      }),
      stat: jest.fn().mockImplementation((path) => {
        return Promise.resolve({
          isDirectory: () => path.includes('.ruler'),
          isFile: () => !path.includes('.ruler'),
        });
      }),
    },
  };
});

jest.mock('../../src/core/FileSystemUtils', () => ({
  findRulerDir: jest.fn().mockResolvedValue('/test/.ruler'),
  readMarkdownFiles: jest.fn().mockResolvedValue([
    {
      path: '/test/.ruler/AGENTS.md',
      content: '# Test Instructions',
    },
  ]),
}));

jest.mock('../../src/core/GitignoreUtils', () => ({
  updateGitignore: jest.fn().mockResolvedValue(undefined),
}));

describe('Invalid Agent Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('should throw an error when an invalid agent is specified', async () => {
    // This test should fail initially, then pass after our fix
    await expect(
      applyAllAgentConfigs('/test', ['nonexistentAgent'])
    ).rejects.toThrow('Invalid agent specified: nonexistentagent');
  });
});