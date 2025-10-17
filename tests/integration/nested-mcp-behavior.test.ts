import * as fs from 'fs/promises';
import * as path from 'path';

import { applyAllAgentConfigs, allAgents } from '../../src/lib';
import { setupTestProject, teardownTestProject } from '../harness';
import { getNativeMcpPath } from '../../src/paths/mcp';

describe('Nested MCP propagation', () => {
  const agentsUnderTest = allAgents.filter((agent) =>
    ['claude', 'copilot', 'windsurf'].includes(agent.getIdentifier()),
  );

  let projectRoot: string;

  beforeAll(async () => {
    ({ projectRoot } = await setupTestProject());

    const moduleDir = path.join(projectRoot, 'module');
    const submoduleDir = path.join(moduleDir, 'submodule');

    await fs.mkdir(path.join(projectRoot, '.ruler'), { recursive: true });
    await fs.mkdir(path.join(moduleDir, '.ruler'), { recursive: true });
    await fs.mkdir(path.join(submoduleDir, '.ruler'), { recursive: true });

    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'AGENTS.md'),
      '# Root instructions',
    );
    await fs.writeFile(
      path.join(moduleDir, '.ruler', 'AGENTS.md'),
      '# Module instructions',
    );
    await fs.writeFile(
      path.join(submoduleDir, '.ruler', 'AGENTS.md'),
      '# Submodule instructions',
    );

    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      `default_agents = [${agentsUnderTest
        .map((agent) => `"${agent.getIdentifier()}"`)
        .join(', ')}]

[mcp]
enabled = true

[agents]
[agents.claude]
enabled = true

[agents.claude.mcp]
enabled = true

[agents.copilot]
enabled = true

[agents.copilot.mcp]
enabled = true

[agents.windsurf]
enabled = true

[agents.windsurf.mcp]
enabled = false

[mcp_servers.root_stdio]
command = "root-command"
args = ["--stdio"]
`,
    );

    await fs.writeFile(
      path.join(moduleDir, '.ruler', 'ruler.toml'),
      `default_agents = ["claude", "copilot", "windsurf"]

[agents]
[agents.copilot]
enabled = true

[agents.copilot.mcp]
enabled = false

[agents.windsurf]
enabled = true

[agents.windsurf.mcp]
enabled = true

[mcp_servers.module_remote]
url = "https://module.example"
`,
    );

    await fs.writeFile(
      path.join(submoduleDir, '.ruler', 'ruler.toml'),
      `default_agents = ["windsurf"]

[agents]
[agents.windsurf]
enabled = true

[agents.windsurf.mcp]
enabled = true

[mcp_servers.sub_stdio]
command = "sub-command"
`,
    );

    // Seed an existing Claude MCP file so backups are exercised
    await fs.writeFile(
      path.join(projectRoot, '.mcp.json'),
      JSON.stringify({ old: 'value' }, null, 2) + '\n',
    );
  });

  afterAll(async () => {
    await teardownTestProject(projectRoot);
  });

  it('writes per-directory MCP configs, honours disabled agents, and updates gitignore in nested mode', async () => {
    const agentIdentifiers = agentsUnderTest.map((agent) =>
      agent.getIdentifier(),
    );

    await applyAllAgentConfigs(
      projectRoot,
      agentIdentifiers,
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

    const moduleDir = path.join(projectRoot, 'module');
    const submoduleDir = path.join(moduleDir, 'submodule');

    const extractServers = (
      data: Record<string, unknown>,
    ): Record<string, unknown> => {
      const potential =
        (data.mcpServers as Record<string, unknown> | undefined) ??
        (data.servers as Record<string, unknown> | undefined);
      return potential ?? {};
    };

    const expectedGitignoreEntries = new Set<string>();

    const expectedMcpTargets: Array<{
      agentName: string;
      baseDir: string;
      shouldExist: boolean;
    }> = [
      { agentName: 'Claude Code', baseDir: projectRoot, shouldExist: true },
      { agentName: 'GitHub Copilot', baseDir: projectRoot, shouldExist: true },
      { agentName: 'Windsurf', baseDir: projectRoot, shouldExist: false },
      { agentName: 'Claude Code', baseDir: moduleDir, shouldExist: true },
      { agentName: 'GitHub Copilot', baseDir: moduleDir, shouldExist: false },
      { agentName: 'Windsurf', baseDir: moduleDir, shouldExist: true },
      { agentName: 'Claude Code', baseDir: submoduleDir, shouldExist: true },
      { agentName: 'GitHub Copilot', baseDir: submoduleDir, shouldExist: true },
      { agentName: 'Windsurf', baseDir: submoduleDir, shouldExist: true },
    ];

    for (const { agentName, baseDir, shouldExist } of expectedMcpTargets) {
      const target = await getNativeMcpPath(agentName, baseDir);

      if (!target) {
        continue;
      }

      const exists = await fs
        .access(target)
        .then(() => true)
        .catch(() => false);

      if (shouldExist) {
        expect(exists).toBe(true);
        const content = await fs.readFile(target, 'utf8');
        const parsed = JSON.parse(content) as Record<string, unknown>;
        expect(Object.keys(extractServers(parsed))).not.toHaveLength(0);
        const relative =
          '/' + path.relative(projectRoot, target).split(path.sep).join('/');
        expectedGitignoreEntries.add(relative);
        expectedGitignoreEntries.add(`${relative}.bak`);
      } else {
        expect(exists).toBe(false);
      }
    }

    const gitignore = await fs.readFile(
      path.join(projectRoot, '.gitignore'),
      'utf8',
    );

    for (const entry of expectedGitignoreEntries) {
      expect(gitignore).toContain(entry);
    }

    const claudeBackupExists = await fs
      .access(path.join(projectRoot, '.mcp.json.bak'))
      .then(() => true)
      .catch(() => false);
    expect(claudeBackupExists).toBe(true);

    const rootMcp = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.mcp.json'), 'utf8'),
    ) as Record<string, unknown>;
    const rootServers = extractServers(rootMcp);
    expect(rootServers).toHaveProperty('root_stdio');
    expect(rootServers).not.toHaveProperty('module_remote');

    const moduleMcp = JSON.parse(
      await fs.readFile(path.join(moduleDir, '.mcp.json'), 'utf8'),
    ) as Record<string, unknown>;
    const moduleServers = extractServers(moduleMcp);
    expect(moduleServers).toHaveProperty('module_remote');
    expect(moduleServers).not.toHaveProperty('root_stdio');

    const subMcp = JSON.parse(
      await fs.readFile(path.join(submoduleDir, '.mcp.json'), 'utf8'),
    ) as Record<string, unknown>;
    const subServers = extractServers(subMcp);
    expect(subServers).toHaveProperty('sub_stdio');
    expect(subServers).not.toHaveProperty('module_remote');
  });
});
