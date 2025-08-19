import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { RooAgent } from '../../../src/agents/RooAgent';

describe('RooAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-roo-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should have the correct identifier', () => {
    const agent = new RooAgent();
    expect(agent.getIdentifier()).toBe('roo_code');
  });

  it('should have the correct name', () => {
    const agent = new RooAgent();
    expect(agent.getName()).toBe('Roo');
  });

  it('should generate the default output path correctly', () => {
    const agent = new RooAgent();
    const expectedPath = path.join(
      tmpDir,
      '.roo',
      'rules',
      'ruler_roo_instructions.md',
    );
    expect(agent.getDefaultOutputPath(tmpDir)).toBe(expectedPath);
  });

  it('should apply ruler config and write to the output path in .roo/rules', async () => {
    const agent = new RooAgent();
    const rules = 'test rules';
    const outputPath = path.join(
      tmpDir,
      '.roo',
      'rules',
      'ruler_roo_instructions.md',
    );

    await agent.applyRulerConfig(rules, tmpDir, null);

    expect(await fs.readFile(outputPath, 'utf8')).toBe(rules);
  });
});
