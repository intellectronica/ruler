import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { parse as parseTOML } from '@iarna/toml';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from '../harness';

describe('End-to-End Ruler CLI', () => {
  let testProject: { projectRoot: string };

  beforeAll(async () => {
    testProject = await setupTestProject({
      '.ruler/a.md': 'Rule A',
      '.ruler/b.md': 'Rule B',
      '.ruler/mcp.json': JSON.stringify({ mcpServers: { example: { command: 'uvx', args: ['mcp-example'] } } })
    });
  });

  afterAll(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  beforeEach(async () => {
    const { projectRoot } = testProject;
    // Clean up generated files before each test
    await fs.rm(path.join(projectRoot, '.github'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, 'CLAUDE.md'), { force: true });
    await fs.rm(path.join(projectRoot, 'AGENTS.md'), { force: true });
    await fs.rm(path.join(projectRoot, '.cursor'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, '.windsurf'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, '.clinerules'), { force: true });
    await fs.rm(path.join(projectRoot, '.aider.conf.yml'), { force: true });
    await fs.rm(path.join(projectRoot, '.junie'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, '.idx'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, '.gitignore'), { force: true });
    // Clean up any custom files from previous tests
    await fs.rm(path.join(projectRoot, 'awesome.md'), { force: true });
    await fs.rm(path.join(projectRoot, 'custom-claude.md'), { force: true });
    await fs.rm(path.join(projectRoot, 'custom_cursor.md'), { force: true });
    // Reset the TOML config to default state
    await fs.rm(path.join(projectRoot, '.ruler', 'ruler.toml'), { force: true });
    // Clean up Open Hands agent files
    await fs.rm(path.join(projectRoot, '.openhands'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, 'config.toml'), { force: true });
    await fs.rm(path.join(projectRoot, '.kilocode'), { recursive: true, force: true });
  });

  it('generates configuration files for all agents', () => {
    const { projectRoot } = testProject;
    
    // Run the CLI
    runRulerWithInheritedStdio('apply', projectRoot);

    // Check some generated files contain concatenated rules
    const claudePath = path.join(projectRoot, 'CLAUDE.md');
    const agentsMdPath = path.join(projectRoot, 'AGENTS.md'); // Used by Codex, Windsurf, Cursor, Aider, etc.
    const clinePath = path.join(projectRoot, '.clinerules');
    const aiderCfg = path.join(projectRoot, '.aider.conf.yml');
    const firebasePath = path.join(projectRoot, '.idx', 'airules.md');
    const openHandsInstructionsPath = path.join(
      projectRoot,
      '.openhands',
      'microagents',
      'repo.md',
    );
    const openHandsConfigPath = path.join(
      projectRoot,
      'config.toml',
    );
    const juniePath = path.join(projectRoot, '.junie', 'guidelines.md');
    const kilocodePath = path.join(
      projectRoot,
      '.kilocode',
      'rules',
      'ruler_kilocode_instructions.md',
    );

    return Promise.all([
      expect(fs.readFile(claudePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(agentsMdPath, 'utf8')).resolves.toContain('Rule A'), // Used by Codex, Windsurf, Cursor, Aider, etc.
      expect(fs.readFile(clinePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(aiderCfg, 'utf8')).resolves.toContain('AGENTS.md'),
      expect(fs.readFile(firebasePath, 'utf8')).resolves.toContain('Rule B'),
      expect(
        fs.readFile(openHandsInstructionsPath, 'utf8'),
      ).resolves.toContain('Rule A'),
      expect(fs.readFile(juniePath, 'utf8')).resolves.toContain('Rule B'),
      expect(fs.readFile(kilocodePath, 'utf8')).resolves.toContain('Rule A')
    ])
      .then(async () => {
        const ohToml = await fs.readFile(openHandsConfigPath, 'utf8');
        const ohParsed: any = parseTOML(ohToml);
        expect(ohParsed.mcp.stdio_servers[0].name).toBe('example');
      });
  }, 30000);

  it('respects default_agents in config file', async () => {
    const toml = `default_agents = ["GitHub Copilot", "Claude Code"]`;
    await fs.writeFile(path.join(testProject.projectRoot, '.ruler', 'ruler.toml'), toml);
    runRulerWithInheritedStdio('apply', testProject.projectRoot);
    await expect(
      fs.readFile(path.join(testProject.projectRoot, 'AGENTS.md'), 'utf8'),
    ).resolves.toContain('Rule A');
    await expect(
      fs.readFile(path.join(testProject.projectRoot, 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('Rule B');
  });

  it('CLI --agents overrides default_agents', async () => {
    const toml = `default_agents = ["GitHub Copilot", "Claude Code"]`;
    await fs.writeFile(path.join(testProject.projectRoot, '.ruler', 'ruler.toml'), toml);
    runRulerWithInheritedStdio('apply --agents codex', testProject.projectRoot);
    await expect(
      fs.readFile(path.join(testProject.projectRoot, 'AGENTS.md'), 'utf8'),
    ).resolves.toContain('Rule A');
    await expect(
      fs.stat(path.join(testProject.projectRoot, 'CLAUDE.md')),
    ).rejects.toThrow();
  });

  it('CLI --agents firebase creates .idx/airules.md', async () => {
    runRulerWithInheritedStdio('apply --agents firebase', testProject.projectRoot);
    const firebasePath = path.join(testProject.projectRoot, '.idx', 'airules.md');
    await expect(
      fs.readFile(firebasePath, 'utf8'),
    ).resolves.toContain('Rule A');
    await expect(
      fs.readFile(firebasePath, 'utf8'),
    ).resolves.toContain('Rule B');
    // Ensure no other agent files were created
    await expect(
      fs.stat(path.join(testProject.projectRoot, 'AGENTS.md')),
    ).rejects.toThrow();
    await expect(
      fs.stat(path.join(testProject.projectRoot, 'CLAUDE.md')),
    ).rejects.toThrow();
  });

  it('uses custom config file via --config', async () => {
    const alt = path.join(testProject.projectRoot, 'custom.toml');
    const toml = `default_agents = ["Cursor"]
[agents.Cursor]
output_path = "custom_cursor.md"
`;
    await fs.writeFile(alt, toml);
    runRulerWithInheritedStdio(`apply --config ${alt}`, testProject.projectRoot);
    await expect(
      fs.readFile(path.join(testProject.projectRoot, 'custom_cursor.md'), 'utf8'),
    ).resolves.toContain('Rule A');
  });

  it('honors custom output_path in config', async () => {
    const toml = `
[agents.Copilot]
output_path = "awesome.md"
`;
    await fs.writeFile(path.join(testProject.projectRoot, '.ruler', 'ruler.toml'), toml);
    runRulerWithInheritedStdio('apply', testProject.projectRoot);
    await expect(
      fs.readFile(path.join(testProject.projectRoot, 'awesome.md'), 'utf8'),
    ).resolves.toContain('Rule A');
  });

  describe('gitignore CLI flags', () => {
    it('accepts --gitignore flag without error', () => {
      expect(() => {
        runRulerWithInheritedStdio('apply --gitignore', testProject.projectRoot);
      }).not.toThrow();
    });

    it('accepts --no-gitignore flag without error', () => {
      expect(() => {
        runRulerWithInheritedStdio('apply --no-gitignore', testProject.projectRoot);
      }).not.toThrow();
    });

    it('accepts both --gitignore and --no-gitignore with precedence to --no-gitignore', () => {
      expect(() => {
        runRulerWithInheritedStdio('apply --gitignore --no-gitignore', testProject.projectRoot);
      }).not.toThrow();
    });
  });

  describe('gitignore integration', () => {
    it('creates .gitignore with generated file paths by default', async () => {
      
      runRulerWithInheritedStdio('apply', testProject.projectRoot);

      const gitignorePath = path.join(testProject.projectRoot, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');

      expect(gitignoreContent).toContain('# START Ruler Generated Files');
      expect(gitignoreContent).toContain('# END Ruler Generated Files');
      expect(gitignoreContent).toContain('CLAUDE.md');
      expect(gitignoreContent).toContain('AGENTS.md');
      expect(gitignoreContent).toContain('.clinerules');
      expect(gitignoreContent).toContain('.aider.conf.yml');
      expect(gitignoreContent).toContain('.idx/airules.md');
      expect(gitignoreContent).toContain('.openhands/microagents/repo.md');
      expect(gitignoreContent).toContain('config.toml');
    });

    it('does not update .gitignore when --no-gitignore is used', async () => {
      
      runRulerWithInheritedStdio('apply --no-gitignore', testProject.projectRoot);

      const gitignorePath = path.join(testProject.projectRoot, '.gitignore');
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('respects [gitignore] enabled = false in TOML config', async () => {
      const toml = `[gitignore]
enabled = false`;
      await fs.writeFile(path.join(testProject.projectRoot, '.ruler', 'ruler.toml'), toml);

      
      runRulerWithInheritedStdio('apply', testProject.projectRoot);

      const gitignorePath = path.join(testProject.projectRoot, '.gitignore');
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('CLI --no-gitignore overrides TOML enabled = true', async () => {
      const toml = `[gitignore]
enabled = true`;
      await fs.writeFile(path.join(testProject.projectRoot, '.ruler', 'ruler.toml'), toml);

      
      runRulerWithInheritedStdio('apply --no-gitignore', testProject.projectRoot);

      const gitignorePath = path.join(testProject.projectRoot, '.gitignore');
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('updates existing .gitignore preserving other content', async () => {
      const gitignorePath = path.join(testProject.projectRoot, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n*.log\n');

      
      runRulerWithInheritedStdio('apply', testProject.projectRoot);

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
      await fs.writeFile(path.join(testProject.projectRoot, '.ruler', 'ruler.toml'), toml);

      
      runRulerWithInheritedStdio('apply --agents claude', testProject.projectRoot);

      const gitignorePath = path.join(testProject.projectRoot, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      expect(gitignoreContent).toContain('custom-claude.md');
      expect(gitignoreContent).not.toContain('CLAUDE.md');
    });
  });

  describe('gitignore generation for all configs', () => {
    let gitignoreTestProject: { projectRoot: string };
    let gitignorePath: string;

    beforeAll(async () => {
      // Create a dedicated test project for gitignore testing
      gitignoreTestProject = await setupTestProject({
        '.ruler/AGENTS.md': 'test',
        '.ruler/mcp.json': JSON.stringify({ mcpServers: { example: { command: 'uvx', args: ['mcp-example'] } } })
      });

      // Create the necessary subdirectories that the agents will write to
      await fs.mkdir(path.join(gitignoreTestProject.projectRoot, '.vscode'), { recursive: true });
      await fs.mkdir(path.join(gitignoreTestProject.projectRoot, '.gemini'), { recursive: true });
      await fs.mkdir(path.join(gitignoreTestProject.projectRoot, '.cursor'), { recursive: true });

      // Run the command that is being tested
      runRulerWithInheritedStdio('apply', gitignoreTestProject.projectRoot);

      // Read the generated .gitignore
      gitignorePath = path.join(gitignoreTestProject.projectRoot, '.gitignore');
    }, 30000);

    afterAll(async () => {
      // Clean up the temporary directory
      await teardownTestProject(gitignoreTestProject.projectRoot);
    });

    it('should include all required file patterns in the generated .gitignore', async () => {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');

      const expectedPatterns = [
        // MCP config files (root-anchored)
        '/.vscode/mcp.json',
        '/.gemini/settings.json', 
        '/.cursor/mcp.json',
        '/.mcp.json',
        // Generated agent files (root-anchored)
        '/AGENTS.md',
        '/CLAUDE.md',
        // Specific backup patterns instead of *.bak
        '/.vscode/mcp.json.bak',
        '/AGENTS.md.bak',
        '/CLAUDE.md.bak'
      ];

      // Should NOT contain broad wildcards
      expect(gitignoreContent).not.toContain('*.bak');

      for (const pattern of expectedPatterns) {
        expect(gitignoreContent).toContain(pattern);
      }
    });
  });
});
