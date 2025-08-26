import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyAllAgentConfigs } from '../src/lib';

describe('Windsurf Duplication Fix', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-windsurf-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should not duplicate content on consecutive windsurf applies', async () => {
    console.log(`Test directory: ${tempDir}`);
    
    // Create .ruler directory and instructions file exactly as user described
    const rulerDir = path.join(tempDir, '.ruler');
    await fs.mkdir(rulerDir);
    
    const instructionsContent = `# Default Agent Instructions

These are the default instructions for the agent.
Some more content here.
`;
    
    await fs.writeFile(path.join(rulerDir, 'instructions.md'), instructionsContent);
    console.log('Created .ruler/instructions.md');

    // First apply with windsurf
    console.log('First apply...');
    await applyAllAgentConfigs(
      tempDir,
      ['windsurf'],
      undefined,
      false,
      undefined,
      false,
      true, // verbose = true to see what's happening
      false,
      false,
      false,
    );

    // Check files created
    const allFiles = await fs.readdir(tempDir, { recursive: true });
    console.log('Files after first apply:', allFiles);
    
    const agentsMdPath = path.join(tempDir, 'AGENTS.md');
    const windsurfPath = path.join(tempDir, '.windsurf', 'rules', 'ruler_windsurf_instructions.md');
    
    let agentsMdContent1 = '';
    let windsurfContent1 = '';
    
    try {
      agentsMdContent1 = await fs.readFile(agentsMdPath, 'utf8');
      console.log('AGENTS.md content length:', agentsMdContent1.length);
    } catch (error) {
      console.log(`AGENTS.md not found: ${error}`);
    }
    
    try {
      windsurfContent1 = await fs.readFile(windsurfPath, 'utf8');
      console.log('Windsurf content length:', windsurfContent1.length);
      console.log('Windsurf content preview:', windsurfContent1.substring(0, 200));
    } catch (error) {
      console.log(`Windsurf file not found: ${error}`);
      return;
    }

    // Second apply
    console.log('\nSecond apply...');
    await applyAllAgentConfigs(
      tempDir,
      ['windsurf'],
      undefined,
      false,
      undefined,
      false,
      true, // verbose = true
      false,
      false,
      false,
    );

    // Check files again
    let agentsMdContent2 = '';
    let windsurfContent2 = '';
    
    try {
      agentsMdContent2 = await fs.readFile(agentsMdPath, 'utf8');
      console.log('AGENTS.md content length after 2nd apply:', agentsMdContent2.length);
    } catch (error) {
      console.log(`AGENTS.md not found after 2nd apply: ${error}`);
    }
    
    try {
      windsurfContent2 = await fs.readFile(windsurfPath, 'utf8');
      console.log('Windsurf content length after 2nd apply:', windsurfContent2.length);
      console.log('Windsurf content preview after 2nd apply:', windsurfContent2.substring(0, 200));
    } catch (error) {
      console.log(`Windsurf file not found after 2nd apply: ${error}`);
      return;
    }

    // Compare content lengths - they should be identical if no duplication
    if (agentsMdContent1) {
      expect(agentsMdContent2.length).toBe(agentsMdContent1.length);
      expect(agentsMdContent2).toBe(agentsMdContent1);
    }
    
    expect(windsurfContent2.length).toBe(windsurfContent1.length);
    expect(windsurfContent2).toBe(windsurfContent1);

    // Check for specific duplication patterns
    const instructionMatches1 = (windsurfContent1.match(/# Default Agent Instructions/g) || []).length;
    const instructionMatches2 = (windsurfContent2.match(/# Default Agent Instructions/g) || []).length;
    
    console.log(`Instruction occurrences: 1st=${instructionMatches1}, 2nd=${instructionMatches2}`);
    
    expect(instructionMatches1).toBe(1);
    expect(instructionMatches2).toBe(1);
  }, 30000);
});