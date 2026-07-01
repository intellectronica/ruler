import * as path from 'path';
import * as fs from 'fs/promises';
import { applyAllAgentConfigs } from '../../src/lib';
import { setupTestProject, teardownTestProject } from '../harness';

describe('Nested folder propagation', () => {
  let projectRoot: string;

  beforeEach(async () => {
    ({ projectRoot } = await setupTestProject());
  });

  afterEach(async () => {
    await teardownTestProject(projectRoot);
  });

  it('propagates root-level folders in nested mode', async () => {
    const rulerDir = path.join(projectRoot, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root Rules');
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Root Prompt');

    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
default_agents = ["claude"]
nested = true

[folders]
enabled = true

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      projectRoot,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
      true,
    );

    const claudeMd = await fs.readFile(
      path.join(projectRoot, 'CLAUDE.md'),
      'utf8',
    );
    expect(claudeMd).toContain('# Root Rules');
    expect(claudeMd).not.toContain('# Root Prompt');

    const promptContent = await fs.readFile(
      path.join(projectRoot, '.claude', 'prompts', 'intro.md'),
      'utf8',
    );
    expect(promptContent).toBe('# Root Prompt');
  });

  it('propagates module-level folders in nested mode', async () => {
    const moduleDir = path.join(projectRoot, 'packages', 'core');
    const moduleRulerDir = path.join(moduleDir, '.ruler');
    const modulePromptsDir = path.join(moduleRulerDir, 'prompts');
    await fs.mkdir(modulePromptsDir, { recursive: true });
    await fs.writeFile(path.join(moduleRulerDir, 'AGENTS.md'), '# Module Rules');
    await fs.writeFile(path.join(modulePromptsDir, 'intro.md'), '# Module Prompt');

    await fs.writeFile(
      path.join(moduleRulerDir, 'ruler.toml'),
      `
default_agents = ["claude"]
nested = true

[folders]
enabled = true

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      projectRoot,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
      true,
    );

    const moduleClaudeMd = await fs.readFile(
      path.join(moduleDir, 'CLAUDE.md'),
      'utf8',
    );
    expect(moduleClaudeMd).toContain('# Module Rules');
    expect(moduleClaudeMd).not.toContain('# Module Prompt');

    const promptContent = await fs.readFile(
      path.join(moduleDir, '.claude', 'prompts', 'intro.md'),
      'utf8',
    );
    expect(promptContent).toBe('# Module Prompt');

    await expect(
      fs.access(path.join(projectRoot, '.claude', 'prompts')),
    ).rejects.toThrow();
  });

  it('isolates root and module folder propagation', async () => {
    const rulerDir = path.join(projectRoot, '.ruler');
    const rootPromptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(rootPromptsDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root Rules');
    await fs.writeFile(path.join(rootPromptsDir, 'intro.md'), '# Root Prompt');

    const moduleDir = path.join(projectRoot, 'packages', 'core');
    const moduleRulerDir = path.join(moduleDir, '.ruler');
    const moduleTemplatesDir = path.join(moduleRulerDir, 'templates');
    await fs.mkdir(moduleTemplatesDir, { recursive: true });
    await fs.writeFile(path.join(moduleRulerDir, 'AGENTS.md'), '# Module Rules');
    await fs.writeFile(
      path.join(moduleTemplatesDir, 'readme.md'),
      '# Module Template',
    );

    const rootToml = `
default_agents = ["claude"]
nested = true

[folders]
enabled = true

[folders.agents.claude]
prompts = ".claude/prompts"
`;

    const moduleToml = `
default_agents = ["claude"]
nested = true

[folders]
enabled = true

[folders.agents.claude]
templates = ".claude/templates"
`;

    await Promise.all([
      fs.writeFile(path.join(rulerDir, 'ruler.toml'), rootToml),
      fs.writeFile(path.join(moduleRulerDir, 'ruler.toml'), moduleToml),
    ]);

    await applyAllAgentConfigs(
      projectRoot,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
      true,
    );

    const rootClaudeMd = await fs.readFile(
      path.join(projectRoot, 'CLAUDE.md'),
      'utf8',
    );
    expect(rootClaudeMd).toContain('# Root Rules');
    expect(rootClaudeMd).not.toContain('# Root Prompt');
    expect(rootClaudeMd).not.toContain('# Module Rules');
    expect(rootClaudeMd).not.toContain('# Module Template');

    const rootPrompt = await fs.readFile(
      path.join(projectRoot, '.claude', 'prompts', 'intro.md'),
      'utf8',
    );
    expect(rootPrompt).toBe('# Root Prompt');

    const moduleTemplate = await fs.readFile(
      path.join(moduleDir, '.claude', 'templates', 'readme.md'),
      'utf8',
    );
    expect(moduleTemplate).toBe('# Module Template');

    await expect(
      fs.access(path.join(projectRoot, '.claude', 'templates')),
    ).rejects.toThrow();

    await expect(
      fs.access(path.join(moduleDir, '.claude', 'prompts')),
    ).rejects.toThrow();
  });
});
