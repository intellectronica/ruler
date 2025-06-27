import * as fs from 'fs-extra';
import * as path from 'path';
import { JulesAgent } from '../../../src/agents/JulesAgent';
import { IAgentConfig } from '../../../src/agents/IAgent'; // Import IAgentConfig

const projectRoot = path.join(__dirname, '../../..'); // Adjusted path for tests
const defaultOutputPath = path.join(projectRoot, 'AGENTS.md');
const backupPath = `${defaultOutputPath}.bak`;

describe('JulesAgent', () => {
  let agent: JulesAgent;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    // fs.readFileSync is not directly used by JulesAgent after changes, but good to keep if other tests need it.
    // jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');

    agent = new JulesAgent();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return "jules" as the identifier', () => {
    expect(agent.getIdentifier()).toBe('jules');
  });

  it('should return "Jules" as the name', () => {
    expect(agent.getName()).toBe('Jules');
  });

  it('should return the correct default output path', () => {
    // getDefaultOutputPath now requires projectRoot
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(defaultOutputPath);
  });

  describe('applyRulerConfig', () => {
    const concatenatedRulesContent = `## Jules - Agent Rules\n\n### Rule1\nDescription1\n\n### Rule2\nDescription2\n`;
    const emptyRulesContent = `## Jules - Agent Rules\n\n`;

    let processedPaths: Set<string>;

    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockClear();
      (fs.copyFileSync as jest.Mock).mockClear();
      (fs.writeFileSync as jest.Mock).mockClear();
      processedPaths = new Set<string>();
    });

    it('should write the concatenated rules to the default output path and add path to processedPaths', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await agent.applyRulerConfig(concatenatedRulesContent, projectRoot, null, undefined, processedPaths);

      expect(fs.writeFileSync).toHaveBeenCalledWith(defaultOutputPath, concatenatedRulesContent);
      expect(processedPaths.has(defaultOutputPath)).toBe(true);
    });

    it('should create a backup if the output file already exists and add path to processedPaths', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath) => filePath === defaultOutputPath);

      await agent.applyRulerConfig(concatenatedRulesContent, projectRoot, null, undefined, processedPaths);

      expect(fs.copyFileSync).toHaveBeenCalledWith(defaultOutputPath, backupPath);
      expect(fs.writeFileSync).toHaveBeenCalledWith(defaultOutputPath, concatenatedRulesContent);
      expect(processedPaths.has(defaultOutputPath)).toBe(true);
    });

    it('should handle empty (but pre-formatted) rules content and add path to processedPaths', async () => {
      await agent.applyRulerConfig(emptyRulesContent, projectRoot, null, undefined, processedPaths);

      expect(fs.writeFileSync).toHaveBeenCalledWith(defaultOutputPath, emptyRulesContent);
      expect(processedPaths.has(defaultOutputPath)).toBe(true);
    });

    it('should use the output path from agentConfig if provided and add path to processedPaths', async () => {
      const customOutputPath = path.join(projectRoot, 'CUSTOM_AGENTS.md');
      const agentConfig: IAgentConfig = { outputPath: customOutputPath };

      await agent.applyRulerConfig(concatenatedRulesContent, projectRoot, null, agentConfig, processedPaths);

      expect(fs.writeFileSync).toHaveBeenCalledWith(customOutputPath, concatenatedRulesContent);
      expect(processedPaths.has(customOutputPath)).toBe(true);

      // Ensure backup is also to the custom path
      (fs.existsSync as jest.Mock).mockImplementationOnce((filePath) => filePath === customOutputPath);
      // For this sub-test, clear processedPaths to simulate a separate run for backup check on custom path
      processedPaths.clear();
      await agent.applyRulerConfig(concatenatedRulesContent, projectRoot, null, agentConfig, processedPaths);
      const customBackupPath = `${customOutputPath}.bak`;
      expect(fs.copyFileSync).toHaveBeenCalledWith(customOutputPath, customBackupPath);
      expect(processedPaths.has(customOutputPath)).toBe(true);
    });

    it('should skip writing if output path is already in processedPaths', async () => {
      processedPaths.add(defaultOutputPath); // Simulate path already processed

      await agent.applyRulerConfig(concatenatedRulesContent, projectRoot, null, undefined, processedPaths);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.copyFileSync).not.toHaveBeenCalled(); // Also no backup should be made
      // console.log should have been called with the skipping message
      expect(console.log).toHaveBeenCalledWith(`[JulesAgent] Output path ${defaultOutputPath} already processed. Skipping write.`);
    });

    it('should skip writing if custom output path from agentConfig is already in processedPaths', async () => {
      const customOutputPath = path.join(projectRoot, 'CUSTOM_AGENTS.md');
      const agentConfig: IAgentConfig = { outputPath: customOutputPath };
      processedPaths.add(customOutputPath); // Simulate custom path already processed

      await agent.applyRulerConfig(concatenatedRulesContent, projectRoot, null, agentConfig, processedPaths);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(`[JulesAgent] Output path ${customOutputPath} already processed. Skipping write.`);
    });
  });
});
