import { JunieAgent } from '../../../src/agents/JunieAgent';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';

jest.mock('../../../src/core/FileSystemUtils');

describe('JunieAgent', () => {
  let agent: JunieAgent;

  beforeEach(() => {
    agent = new JunieAgent();
    jest.clearAllMocks();
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('junie');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Junie');
  });

  it('should return the correct default output path', () => {
    expect(agent.getDefaultOutputPath('/root')).toBe('/root/.junie/guidelines.md');
  });

  it('should apply ruler config to the default output path', async () => {
    const ensureDirExists = jest.spyOn(FileSystemUtils, 'ensureDirExists');
    const backupFile = jest.spyOn(FileSystemUtils, 'backupFile');
    const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');

    await agent.applyRulerConfig('rules', '/root', null);

    expect(ensureDirExists).toHaveBeenCalledWith('/root/.junie');
    expect(backupFile).toHaveBeenCalledWith('/root/.junie/guidelines.md');
    expect(writeGeneratedFile).toHaveBeenCalledWith('/root/.junie/guidelines.md', 'rules');
  });

  it('should apply ruler config to a custom output path', async () => {
    const ensureDirExists = jest.spyOn(FileSystemUtils, 'ensureDirExists');
    const backupFile = jest.spyOn(FileSystemUtils, 'backupFile');
    const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');

    await agent.applyRulerConfig('rules', '/root', null, { outputPath: '/custom/path/guidelines.md' });

    expect(ensureDirExists).toHaveBeenCalledWith('/custom/path');
    expect(backupFile).toHaveBeenCalledWith('/custom/path/guidelines.md');
    expect(writeGeneratedFile).toHaveBeenCalledWith('/custom/path/guidelines.md', 'rules');
  });
});