import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('End-to-End Ruler CLI', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-e2e-'));
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'a.md'), 'Rule A');
    await fs.writeFile(path.join(rulerDir, 'b.md'), 'Rule B');
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates configuration files for all agents', () => {
    // Ensure latest build
    execSync('npm run build', { stdio: 'inherit' });
    // Run the CLI
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });

    // Check some generated files contain concatenated rules
    const copilotPath = path.join(tmpDir, '.github', 'copilot-instructions.md');
    const claudePath = path.join(tmpDir, 'CLAUDE.md');
    const codexPath = path.join(tmpDir, 'AGENTS.md');
    const cursorPath = path.join(tmpDir, '.cursor', 'rules', 'ruler_cursor_instructions.md');
    const windsurfPath = path.join(tmpDir, '.windsurf', 'rules', 'ruler_windsurf_instructions.md');
    const clinePath = path.join(tmpDir, '.clinerules');
    const aiderMd = path.join(tmpDir, 'ruler_aider_instructions.md');
    const aiderCfg = path.join(tmpDir, '.aider.conf.yml');

    return Promise.all([
      expect(fs.readFile(copilotPath, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(claudePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(codexPath, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(cursorPath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(windsurfPath, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(clinePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(aiderMd, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(aiderCfg, 'utf8')).resolves.toContain('ruler_aider_instructions.md'),
    ]);
  });
});