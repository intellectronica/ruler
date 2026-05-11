import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { OpenHandsAgent } from '../../../src/agents/OpenHandsAgent';

describe('OpenHandsAgent', () => {
  let tmpDir: string;
  let agent: OpenHandsAgent;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openhands-agent-'));
    agent = new OpenHandsAgent();
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('openhands');
  });
  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Open Hands');
  });
  it('should return the correct default output path for instructions', () => {
    const expected = path.join(tmpDir, '.openhands', 'microagents', 'repo.md');
    expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
  });
  it('should write instructions to the correct file', async () => {
    const rules = 'Test instructions';
    await agent.applyRulerConfig(rules, tmpDir, null);
    const outputPath = path.join(tmpDir, '.openhands', 'microagents', 'repo.md');
    const content = await fs.readFile(outputPath, 'utf8');
    expect(content).toBe(rules);
  });
});