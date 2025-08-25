import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import {
  loadSingleConfiguration,
  RulerConfiguration,
} from '../../../src/core/apply-engine';

// We'll capture console warnings to assert legacy warning emitted only once.
describe('AGENTS.md fallback behavior', () => {
  let tmpDir: string;
  let rulerDir: string;
  let originalWarn: (...args: any[]) => void;
  let warnMessages: string[];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-agentsmd-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    warnMessages = [];
    originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      warnMessages.push(args.join(' '));
    };
  });

  afterEach(async () => {
    console.warn = originalWarn;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeConfig() {
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), '');
  }

  it('uses legacy instructions.md without warning if only legacy file present', async () => {
    await writeConfig();
    const legacy = path.join(rulerDir, 'instructions.md');
    await fs.writeFile(legacy, '# Legacy Rules');

    const result = await loadSingleConfiguration(tmpDir, undefined, false);
    expect((result as RulerConfiguration).concatenatedRules).toContain(
      '# Legacy Rules',
    );
    // Expect no legacy warning now that warning has been removed
    const legacyWarnings = warnMessages.filter((m) =>
      m.includes('instructions.md'),
    );
    expect(legacyWarnings.length).toBe(0);
  });

  it('prefers AGENTS.md ordering over legacy when both exist (no warning)', async () => {
    await writeConfig();
    const legacy = path.join(rulerDir, 'instructions.md');
    const agents = path.join(rulerDir, 'AGENTS.md');
    await fs.writeFile(legacy, '# Legacy Rules');
    await fs.writeFile(agents, '# New Agents Rules');

    const result = await loadSingleConfiguration(tmpDir, undefined, false);
    const configResult = result as RulerConfiguration;
    expect(configResult.concatenatedRules).toContain('# New Agents Rules');
    // Legacy content may still be concatenated, but AGENTS.md section should appear before legacy section.
    const idxNew = configResult.concatenatedRules.indexOf('# New Agents Rules');
    const idxLegacy = configResult.concatenatedRules.indexOf('# Legacy Rules');
    expect(idxNew).toBeGreaterThanOrEqual(0);
    expect(idxLegacy).toBeGreaterThan(idxNew);
    // No legacy warning expected
    const legacyWarnings = warnMessages.filter((m) =>
      m.includes('instructions.md'),
    );
    expect(legacyWarnings.length).toBe(0);
  });

  it('uses AGENTS.md without warning when only AGENTS.md present', async () => {
    await writeConfig();
    const agents = path.join(rulerDir, 'AGENTS.md');
    await fs.writeFile(agents, '# New Agents Rules');

    const result = await loadSingleConfiguration(tmpDir, undefined, false);
    expect((result as RulerConfiguration).concatenatedRules).toContain(
      '# New Agents Rules',
    );
    const legacyWarnings = warnMessages.filter((m) =>
      m.includes('instructions.md'),
    );
    expect(legacyWarnings.length).toBe(0);
  });
  // Removed test verifying single warning emission; warning no longer produced.
});
