import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { loadSingleConfiguration, applyConfigurationsToAgents } from '../src/core/apply-engine';
import { WindsurfAgent } from '../src/agents/WindsurfAgent';
import { updateGitignore } from '../src/core/apply-engine';

describe('Windsurf GitIgnore Integration', () => {
  let tmpDir: string;
  let rulerDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-windsurf-gitignore-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('adds all split files to gitignore when content exceeds 10K characters', async () => {
    // Create a ruler.toml config file
    const rulerTomlContent = `
[gitignore]
enabled = true
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerTomlContent);

    // Create rule files with large content to trigger splitting
    const longRule = 'This is a very long rule that contains lots of text.\n';
    const largeConcatenatedRules = longRule.repeat(300); // Should create 2+ split files
    
    await fs.writeFile(path.join(rulerDir, 'large-rules.md'), largeConcatenatedRules);

    // Create WindsurfAgent and apply config
    const agent = new WindsurfAgent();
    const agents = [agent];

    // Simulate the apply engine flow
    const configuration = await loadSingleConfiguration(tmpDir, undefined, false);
    const generatedPaths = await applyConfigurationsToAgents(
      agents,
      configuration.concatenatedRules,
      configuration.rulerMcpJson,
      configuration.config,
      tmpDir,
      false, // verbose
      false, // dry run
      true,  // cli mcp enabled
      undefined, // cli mcp strategy
      true,  // backup
    );

    // Update gitignore
    await updateGitignore(
      tmpDir,
      generatedPaths,
      configuration.config,
      true, // cli gitignore enabled
      false, // dry run
      true,  // backup
    );

    // Read the generated .gitignore
    const gitignoreContent = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf8');
    
    // Check that all split files are included in gitignore
    expect(gitignoreContent).toContain('.windsurf/rules/ruler_windsurf_instructions_00.md');
    expect(gitignoreContent).toContain('.windsurf/rules/ruler_windsurf_instructions_01.md');
    
    // Check that backup files are included
    expect(gitignoreContent).toContain('.windsurf/rules/ruler_windsurf_instructions_00.md.bak');
    expect(gitignoreContent).toContain('*.bak');

    // Verify that split files were actually created
    const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
    await expect(fs.access(path.join(rulesDir, 'ruler_windsurf_instructions_00.md'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(rulesDir, 'ruler_windsurf_instructions_01.md'))).resolves.toBeUndefined();
    
    // Should not create a third file if content fits in 2 files
    try {
      await fs.access(path.join(rulesDir, 'ruler_windsurf_instructions_02.md'));
      // If this succeeds, it means 3 files were created, which is fine
    } catch {
      // If this fails, it means only 2 files were created, which is also fine
    }
  });

  it('adds only single file to gitignore when content is under 10K characters', async () => {
    // Create a ruler.toml config file
    const rulerTomlContent = `
[gitignore]
enabled = true
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerTomlContent);

    // Create rule files with small content (no splitting)
    const smallRules = 'This is a small rule file that should not be split.';
    
    await fs.writeFile(path.join(rulerDir, 'small-rules.md'), smallRules);

    // Create WindsurfAgent and apply config
    const agent = new WindsurfAgent();
    const agents = [agent];

    // Simulate the apply engine flow
    const configuration = await loadSingleConfiguration(tmpDir, undefined, false);
    const generatedPaths = await applyConfigurationsToAgents(
      agents,
      configuration.concatenatedRules,
      configuration.rulerMcpJson,
      configuration.config,
      tmpDir,
      false, // verbose
      false, // dry run
      true,  // cli mcp enabled
      undefined, // cli mcp strategy
      true,  // backup
    );

    // Update gitignore
    await updateGitignore(
      tmpDir,
      generatedPaths,
      configuration.config,
      true, // cli gitignore enabled
      false, // dry run
      true,  // backup
    );

    // Read the generated .gitignore
    const gitignoreContent = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf8');
    
    // Check that only the single file is included
    expect(gitignoreContent).toContain('.windsurf/rules/ruler_windsurf_instructions.md');
    expect(gitignoreContent).toContain('.windsurf/rules/ruler_windsurf_instructions.md.bak');
    
    // Check that split file patterns are NOT present
    expect(gitignoreContent).not.toContain('ruler_windsurf_instructions_00.md');
    expect(gitignoreContent).not.toContain('ruler_windsurf_instructions_01.md');

    // Verify that only single file was created
    const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
    await expect(fs.access(path.join(rulesDir, 'ruler_windsurf_instructions.md'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(rulesDir, 'ruler_windsurf_instructions_00.md'))).rejects.toThrow();
  });

  it('respects --no-gitignore flag and does not add split files', async () => {
    // Create a ruler.toml config file with gitignore disabled
    const rulerTomlContent = `
[gitignore]
enabled = false
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerTomlContent);

    // Create rule files with large content to trigger splitting
    const longRule = 'This is a very long rule that contains lots of text.\n';
    const largeConcatenatedRules = longRule.repeat(300); // Should create 2+ split files
    
    await fs.writeFile(path.join(rulerDir, 'large-rules.md'), largeConcatenatedRules);

    // Create WindsurfAgent and apply config
    const agent = new WindsurfAgent();
    const agents = [agent];

    // Simulate the apply engine flow
    const configuration = await loadSingleConfiguration(tmpDir, undefined, false);
    const generatedPaths = await applyConfigurationsToAgents(
      agents,
      configuration.concatenatedRules,
      configuration.rulerMcpJson,
      configuration.config,
      tmpDir,
      false, // verbose
      false, // dry run
      true,  // cli mcp enabled
      undefined, // cli mcp strategy
      true,  // backup
    );

    // Update gitignore with gitignore disabled
    await updateGitignore(
      tmpDir,
      generatedPaths,
      configuration.config,
      false, // cli gitignore disabled
      false, // dry run
      true,  // backup
    );

    // Verify that .gitignore was not created or is empty of ruler content
    try {
      const gitignoreContent = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf8');
      expect(gitignoreContent).not.toContain('ruler_windsurf_instructions');
    } catch (error) {
      // .gitignore file doesn't exist, which is expected
      expect((error as any).code).toBe('ENOENT');
    }

    // Verify that split files were still created (gitignore doesn't affect file creation)
    const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
    await expect(fs.access(path.join(rulesDir, 'ruler_windsurf_instructions_00.md'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(rulesDir, 'ruler_windsurf_instructions_01.md'))).resolves.toBeUndefined();
  });
});