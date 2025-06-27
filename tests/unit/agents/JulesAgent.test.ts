
import { JulesAgent } from '../../../src/agents/JulesAgent';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';

jest.mock('../../../src/core/FileSystemUtils');

describe('JulesAgent', () => {
  let agent: JulesAgent;

  beforeEach(() => {
    agent = new JulesAgent();
    jest.clearAllMocks();
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('jules');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Jules');
  });

  it('should return the correct default output path', () => {
    expect(agent.getDefaultOutputPath('/root')).toBe('/root/AGENTS.md');
  });

  it('should apply ruler config to the default output path', async () => {
    const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');
    await agent.applyRulerConfig('rules', '/root', null);
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/AGENTS.md', 'rules');
  });

  it('should apply ruler config to a custom output path', async () => {
    const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');
    await agent.applyRulerConfig('rules', '/root', null, { outputPath: 'CUSTOM.md' });
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/CUSTOM.md', 'rules');
  });
});
