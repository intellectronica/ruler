import * as path from 'path';
import { getNativeMcpPath } from '../../../src/paths/mcp';

describe('QwenCode MCP Path', () => {
  it('should return correct path for Qwen Code agent', async () => {
    const projectRoot = '/tmp/test-project';
    const mcpPath = await getNativeMcpPath('Qwen Code', projectRoot);
    expect(mcpPath).toBe(path.join(projectRoot, '.qwen', 'settings.json'));
  });
});