import { AmpAgent } from '../../../src/agents/AmpAgent';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';

jest.mock('../../../src/core/FileSystemUtils');

describe('AmpAgent', () => {
  let agent: AmpAgent;

  beforeEach(() => {
    agent = new AmpAgent();
    jest.clearAllMocks();
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('amp');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Amp');
  });

  it('should return the correct default output path', () => {
    expect(agent.getDefaultOutputPath('/root')).toBe('/root/AGENT.md');
  });

  it('should apply ruler config to the default output path', async () => {
    const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');
    await agent.applyRulerConfig('rules', '/root', null);
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/AGENT.md', 'rules');
  });

  it('should apply ruler config to a custom output path', async () => {
    const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');
    await agent.applyRulerConfig('rules', '/root', null, { outputPath: 'CUSTOM.md' });
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/CUSTOM.md', 'rules');
  });
});