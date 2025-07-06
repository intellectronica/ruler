import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import TOML from '@iarna/toml';
import { execSync } from 'child_process';

describe('End-to-End Ruler CLI', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-e2e-'));
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'a.md'), 'Rule A');
    await fs.writeFile(path.join(rulerDir, 'b.md'), 'Rule B');
    // Provide a sample MCP config for Open Hands agent
    await fs.writeFile(
      path.join(rulerDir, 'mcp.json'),
      JSON.stringify({ mcpServers: { example: { command: 'uvx', args: ['mcp-example'] } } }),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clean up generated files before each test
    await fs.rm(path.join(tmpDir, '.github'), { recursive: true, force: true });
    await fs.rm(path.join(tmpDir, 'CLAUDE.md'), { force: true });
    await fs.rm(path.join(tmpDir, 'AGENTS.md'), { force: true });
    await fs.rm(path.join(tmpDir, '.cursor'), { recursive: true, force: true });
    await fs.rm(path.join(tmpDir, '.windsurf'), { recursive: true, force: true });
    await fs.rm(path.join(tmpDir, '.clinerules'), { force: true });
    await fs.rm(path.join(tmpDir, 'ruler_aider_instructions.md'), { force: true });
    await fs.rm(path.join(tmpDir, '.aider.conf.yml'), { force: true });
    await fs.rm(path.join(tmpDir, '.idx'), { recursive: true, force: true });
    await fs.rm(path.join(tmpDir, '.gitignore'), { force: true });
    // Clean up any custom files from previous tests
    await fs.rm(path.join(tmpDir, 'awesome.md'), { force: true });
    await fs.rm(path.join(tmpDir, 'custom-claude.md'), { force: true });
    await fs.rm(path.join(tmpDir, 'custom_cursor.md'), { force: true });
    // Reset the TOML config to default state
    await fs.rm(path.join(tmpDir, '.ruler', 'ruler.toml'), { force: true });
    // Clean up Open Hands agent files
    await fs.rm(path.join(tmpDir, '.openhands'), { recursive: true, force: true });
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
    const cursorPath = path.join(tmpDir, '.cursor', 'rules', 'ruler_cursor_instructions.mdc');
    const windsurfPath = path.join(tmpDir, '.windsurf', 'rules', 'ruler_windsurf_instructions.md');
    const clinePath = path.join(tmpDir, '.clinerules');
    const aiderMd = path.join(tmpDir, 'ruler_aider_instructions.md');
    const aiderCfg = path.join(tmpDir, '.aider.conf.yml');
    const firebasePath = path.join(tmpDir, '.idx', 'airules.md');
    const openHandsInstructionsPath = path.join(
      tmpDir,
      '.openhands',
      'microagents',
      'repo.md',
    );
    const openHandsConfigPath = path.join(
      tmpDir,
      '.openhands',
      'config.toml',
    );

    return Promise.all([
      expect(fs.readFile(copilotPath, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(claudePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(codexPath, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(cursorPath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(windsurfPath, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(clinePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(aiderMd, 'utf8')).resolves.toContain('Rule A'),
      expect(fs.readFile(aiderCfg, 'utf8')).resolves.toContain('ruler_aider_instructions.md'),
      expect(fs.readFile(firebasePath, 'utf8')).resolves.toContain('Rule B'),
      expect(
        fs.readFile(openHandsInstructionsPath, 'utf8'),
      ).resolves.toContain('Rule A'),
    ])
      .then(async () => {
        const ohToml = await fs.readFile(openHandsConfigPath, 'utf8');
        const ohParsed: any = TOML.parse(ohToml);
        expect(ohParsed.mcp.stdio_servers[0].name).toBe('example');
      });
  }, 30000);

  it('respects default_agents in config file', async () => {
    const toml = `default_agents = ["GitHub Copilot", "Claude Code"]`;
    await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), toml);
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });
    await expect(
      fs.readFile(path.join(tmpDir, '.github', 'copilot-instructions.md'), 'utf8'),
    ).resolves.toContain('Rule A');
    await expect(
      fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('Rule B');
    await expect(
      fs.stat(path.join(tmpDir, 'AGENTS.md')),
    ).rejects.toThrow();
  });

  it('CLI --agents overrides default_agents', async () => {
    const toml = `default_agents = ["GitHub Copilot", "Claude Code"]`;
    await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), toml);
    execSync(
      `node dist/cli/index.js apply --project-root ${tmpDir} --agents codex`,
      { stdio: 'inherit' },
    );
    await expect(
      fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf8'),
    ).resolves.toContain('Rule A');
    await expect(
      fs.stat(path.join(tmpDir, '.github', 'copilot-instructions.md')),
    ).rejects.toThrow();
  });

  it('CLI --agents firebase creates .idx/airules.md', async () => {
    execSync(
      `node dist/cli/index.js apply --project-root ${tmpDir} --agents firebase`,
      { stdio: 'inherit' },
    );
    const firebasePath = path.join(tmpDir, '.idx', 'airules.md');
    await expect(
      fs.readFile(firebasePath, 'utf8'),
    ).resolves.toContain('Rule A');
    await expect(
      fs.readFile(firebasePath, 'utf8'),
    ).resolves.toContain('Rule B');
    // Ensure no other agent files were created
    await expect(
      fs.stat(path.join(tmpDir, '.github', 'copilot-instructions.md')),
    ).rejects.toThrow();
    await expect(
      fs.stat(path.join(tmpDir, 'CLAUDE.md')),
    ).rejects.toThrow();
  });

  it('uses custom config file via --config', async () => {
    const alt = path.join(tmpDir, 'custom.toml');
    const toml = `default_agents = ["Cursor"]
[agents.Cursor]
output_path = "custom_cursor.md"
`;
    await fs.writeFile(alt, toml);
    execSync(
      `node dist/cli/index.js apply --project-root ${tmpDir} --config ${alt}`,
      { stdio: 'inherit' },
    );
    await expect(
      fs.readFile(path.join(tmpDir, 'custom_cursor.md'), 'utf8'),
    ).resolves.toContain('Rule A');
  });

  it('honors custom output_path in config', async () => {
    const toml = `
[agents.Copilot]
output_path = "awesome.md"
`;
    await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), toml);
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });
    await expect(
      fs.readFile(path.join(tmpDir, 'awesome.md'), 'utf8'),
    ).resolves.toContain('Rule A');
  });

  describe('gitignore CLI flags', () => {
    it('accepts --gitignore flag without error', () => {
      execSync('npm run build', { stdio: 'inherit' });
      expect(() => {
        execSync(
          `node dist/cli/index.js apply --project-root ${tmpDir} --gitignore`,
          { stdio: 'inherit' }
        );
      }).not.toThrow();
    });

    it('accepts --no-gitignore flag without error', () => {
      execSync('npm run build', { stdio: 'inherit' });
      expect(() => {
        execSync(
          `node dist/cli/index.js apply --project-root ${tmpDir} --no-gitignore`,
          { stdio: 'inherit' }
        );
      }).not.toThrow();
    });

    it('accepts both --gitignore and --no-gitignore with precedence to --no-gitignore', () => {
      execSync('npm run build', { stdio: 'inherit' });
      expect(() => {
        execSync(
          `node dist/cli/index.js apply --project-root ${tmpDir} --gitignore --no-gitignore`,
          { stdio: 'inherit' }
        );
      }).not.toThrow();
    });
  });

  describe('gitignore integration', () => {
    it('creates .gitignore with generated file paths by default', async () => {
      execSync('npm run build', { stdio: 'inherit' });
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });

      const gitignorePath = path.join(tmpDir, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      
      expect(gitignoreContent).toContain('# START Ruler Generated Files');
      expect(gitignoreContent).toContain('# END Ruler Generated Files');
      expect(gitignoreContent).toContain('CLAUDE.md');
      expect(gitignoreContent).toContain('.github/copilot-instructions.md');
      expect(gitignoreContent).toContain('AGENTS.md');
      expect(gitignoreContent).toContain('.cursor/rules/ruler_cursor_instructions.mdc');
      expect(gitignoreContent).toContain('.windsurf/rules/ruler_windsurf_instructions.md');
      expect(gitignoreContent).toContain('.clinerules');
      expect(gitignoreContent).toContain('ruler_aider_instructions.md');
      expect(gitignoreContent).toContain('.aider.conf.yml');
      expect(gitignoreContent).toContain('.idx/airules.md');
      expect(gitignoreContent).toContain('.openhands/microagents/repo.md');
      expect(gitignoreContent).toContain('.openhands/config.toml');
      expect(gitignoreContent).toContain('.openhands/microagents/repo.md');
      expect(gitignoreContent).toContain('.openhands/config.toml');
    });

    it('does not update .gitignore when --no-gitignore is used', async () => {
      execSync('npm run build', { stdio: 'inherit' });
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir} --no-gitignore`, { stdio: 'inherit' });

      const gitignorePath = path.join(tmpDir, '.gitignore');
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('respects [gitignore] enabled = false in TOML config', async () => {
      const toml = `[gitignore]
enabled = false`;
      await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), toml);
      
      execSync('npm run build', { stdio: 'inherit' });
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });

      const gitignorePath = path.join(tmpDir, '.gitignore');
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('CLI --no-gitignore overrides TOML enabled = true', async () => {
      const toml = `[gitignore]
enabled = true`;
      await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), toml);
      
      execSync('npm run build', { stdio: 'inherit' });
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir} --no-gitignore`, { stdio: 'inherit' });

      const gitignorePath = path.join(tmpDir, '.gitignore');
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('updates existing .gitignore preserving other content', async () => {
      const gitignorePath = path.join(tmpDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n*.log\n');
      
      execSync('npm run build', { stdio: 'inherit' });
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });

      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      expect(gitignoreContent).toContain('node_modules/');
      expect(gitignoreContent).toContain('*.log');
      expect(gitignoreContent).toContain('# START Ruler Generated Files');
      expect(gitignoreContent).toContain('CLAUDE.md');
      expect(gitignoreContent).toContain('# END Ruler Generated Files');
    });

    it('respects custom output paths in .gitignore', async () => {
      const toml = `[agents.Claude]
output_path = "custom-claude.md"`;
      await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), toml);
      
      execSync('npm run build', { stdio: 'inherit' });
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir} --agents claude`, { stdio: 'inherit' });

      const gitignorePath = path.join(tmpDir, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      expect(gitignoreContent).toContain('custom-claude.md');
      expect(gitignoreContent).not.toContain('CLAUDE.md');
    });
  });

  describe('gitignore generation for all configs', () => {
    let testDir: string;
    let gitignorePath: string;

    beforeAll(async () => {
      // Create a dedicated directory for this test to avoid conflicts
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-gitignore-e2e-'));
      
      // Create the necessary subdirectories that the agents will write to
      await fs.mkdir(path.join(testDir, '.vscode'), { recursive: true });
      await fs.mkdir(path.join(testDir, '.gemini'), { recursive: true });
      await fs.mkdir(path.join(testDir, '.cursor'), { recursive: true });
      
      // Create a dummy .ruler setup
      const rulerDir = path.join(testDir, '.ruler');
      await fs.mkdir(rulerDir);
      await fs.writeFile(path.join(rulerDir, 'instructions.md'), 'test');

      // Run the command that is being tested
      execSync(`node ${path.resolve(__dirname, '..', '..', 'dist', 'cli', 'index.js')} apply --project-root ${testDir}`, { stdio: 'inherit' });
      
      // Read the generated .gitignore
      gitignorePath = path.join(testDir, '.gitignore');
    }, 30000);

    afterAll(async () => {
      // Clean up the temporary directory
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should include all required file patterns in the generated .gitignore', async () => {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');

      const expectedPatterns = [
        '*.bak',
        '.vscode/mcp.json',
        'claude_desktop_config.json',
        '.gemini/settings.json',
        '.cursor/mcp.json',
        '.mcp.json',
        'AGENTS.md', // Example of an existing rule
        'CLAUDE.md'  // Example of an existing rule
      ];

      for (const pattern of expectedPatterns) {
        expect(gitignoreContent).toContain(pattern);
      }
    });
  });
});