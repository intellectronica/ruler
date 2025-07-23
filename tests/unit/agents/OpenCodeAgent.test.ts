import { OpenCodeAgent } from '../../../src/agents/OpenCodeAgent';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';

jest.mock('../../../src/core/FileSystemUtils');

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

  it('should return the correct default output path', () => {
    expect(agent.getDefaultOutputPath('/root')).toBe('/root/AGENTS.md');
  });

  it('should apply ruler config to the default output path', async () => {
    const writeGeneratedFile = jest.spyOn(
      FileSystemUtils,
      'writeGeneratedFile',
    );
    await agent.applyRulerConfig('rules', '/root', null);
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/AGENTS.md', 'rules');
  });

  it('should apply ruler config to a custom output path', async () => {
    const writeGeneratedFile = jest.spyOn(
      FileSystemUtils,
      'writeGeneratedFile',
    );
    await agent.applyRulerConfig('rules', '/root', null, {
      outputPath: 'CUSTOM.md',
    });
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/CUSTOM.md', 'rules');
  });
});
