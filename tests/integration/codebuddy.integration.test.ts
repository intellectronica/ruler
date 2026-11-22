import * as fs from 'fs/promises';
import * as path from 'path';
import {
  setupTestProject,
  teardownTestProject,
  runRulerWithInheritedStdio,
} from '../harness';

describe('CodeBuddy end-to-end integration', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const rulerToml = `
[mcp_servers.local_server]
command = "npx"
args = ["-y", "mcp-fs"]

[mcp_servers.http_server]
url = "https://mcp.example.com/mcp"

[mcp_servers.sse_server]
url = "https://mcp.example.com/sse"

[agents]
enabled = true
`;

    const subagentMd = `---
name: code-reviewer
description: Reviews code changes carefully
tools: [Read, Grep, Glob]
model: inherit
is_background: true
---

Review the diff and report issues.
`;

    testProject = await setupTestProject({
      '.ruler/AGENTS.md':
        '# Project Rules\n\nFollow TypeScript best practices.',
      '.ruler/ruler.toml': rulerToml,
      '.ruler/skills/deploy/SKILL.md':
        '---\nname: deploy\ndescription: Deployment skill\n---\n# Deploy\n',
      '.ruler/agents/code-reviewer.md': subagentMd,
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('applies rules, MCP (stdio/http/sse), skills, subagents, gitignore, and reverts for CodeBuddy', async () => {
    const { projectRoot } = testProject;

    runRulerWithInheritedStdio('apply --agents codebuddy', projectRoot);

    // 1. Rules file at CODEBUDDY.md
    const codebuddyMdPath = path.join(projectRoot, 'CODEBUDDY.md');
    const codebuddyMd = await fs.readFile(codebuddyMdPath, 'utf8');
    expect(codebuddyMd).toContain('Follow TypeScript best practices.');

    // 2. MCP config at .mcp.json with stdio, http, and sse types
    const mcpPath = path.join(projectRoot, '.mcp.json');
    const mcpJson = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
    expect(mcpJson.mcpServers.local_server.type).toBe('stdio');
    expect(mcpJson.mcpServers.local_server.command).toBe('npx');
    expect(mcpJson.mcpServers.http_server.type).toBe('http');
    expect(mcpJson.mcpServers.http_server.url).toBe(
      'https://mcp.example.com/mcp',
    );
    expect(mcpJson.mcpServers.sse_server.type).toBe('sse');
    expect(mcpJson.mcpServers.sse_server.url).toBe(
      'https://mcp.example.com/sse',
    );

    // 3. Skills propagated to .codebuddy/skills/
    const skillPath = path.join(
      projectRoot,
      '.codebuddy',
      'skills',
      'deploy',
      'SKILL.md',
    );
    expect(await fs.readFile(skillPath, 'utf8')).toContain('# Deploy');

    // 4. Subagents propagated to .codebuddy/agents/
    const subagentPath = path.join(
      projectRoot,
      '.codebuddy',
      'agents',
      'code-reviewer.md',
    );
    const subagentContent = await fs.readFile(subagentPath, 'utf8');
    expect(subagentContent).toContain('name: code-reviewer');
    expect(subagentContent).toContain('background: true');
    expect(subagentContent).toContain('Review the diff and report issues.');

    // 5. .gitignore contains generated CodeBuddy entries
    const gitignore = await fs.readFile(
      path.join(projectRoot, '.gitignore'),
      'utf8',
    );
    expect(gitignore).toContain('/CODEBUDDY.md');
    expect(gitignore).toContain('/.mcp.json');
    expect(gitignore).toContain('/.codebuddy/skills/deploy');
    expect(gitignore).toContain('/.codebuddy/agents/code-reviewer.md');

    // 6. Revert removes CODEBUDDY.md and .mcp.json
    runRulerWithInheritedStdio('revert --agents codebuddy', projectRoot);
    await expect(fs.access(codebuddyMdPath)).rejects.toThrow();
    await expect(fs.access(mcpPath)).rejects.toThrow();
  });

  it('supports nested mode generating subdirectory CODEBUDDY.md files', async () => {
    const { projectRoot } = testProject;
    const subDir = path.join(projectRoot, 'packages', 'api');
    await fs.mkdir(path.join(subDir, '.ruler'), { recursive: true });
    await fs.writeFile(
      path.join(subDir, '.ruler', 'AGENTS.md'),
      '# API Rules\n\nValidate all inputs.',
    );

    runRulerWithInheritedStdio(
      'apply --agents codebuddy --nested --no-mcp --no-skills --no-subagents',
      projectRoot,
    );

    const rootRules = await fs.readFile(
      path.join(projectRoot, 'CODEBUDDY.md'),
      'utf8',
    );
    const nestedRules = await fs.readFile(
      path.join(subDir, 'CODEBUDDY.md'),
      'utf8',
    );

    expect(rootRules).toContain('Follow TypeScript best practices.');
    expect(nestedRules).toContain('Validate all inputs.');
  });
});
