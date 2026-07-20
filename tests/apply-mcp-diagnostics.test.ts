import { setupTestProject, teardownTestProject, runRulerAll } from './harness';

describe('apply MCP diagnostics', () => {
  let testProject: { projectRoot: string } | undefined;

  afterEach(async () => {
    if (testProject) {
      await teardownTestProject(testProject.projectRoot);
      testProject = undefined;
    }
  });

  it('prints unified MCP diagnostics while applying', async () => {
    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Rules',
      '.ruler/ruler.toml': `[mcp]
enabled = true

[mcp_servers.bad_toml]
args = ["missing-command"]
`,
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          bad_json: {
            args: ['missing-command'],
          },
        },
      }),
    });

    const output = runRulerAll(
      'apply --agents claude',
      testProject.projectRoot,
    );

    expect(output).toContain('MCP_TOML_INVALID_SERVER');
    expect(output).toContain(
      "MCP server 'bad_toml' must have at least one of command or url",
    );
    expect(output).toContain('MCP_JSON_INVALID_SERVER');
    expect(output).toContain(
      "MCP server 'bad_json' must have at least one of command or url",
    );
    expect(
      output.match(/\[ruler\] Warning: Using legacy \.ruler\/mcp\.json/g),
    ).toHaveLength(1);
  });

  it('prints agent-scoped MCP diagnostics while applying', async () => {
    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Rules',
      '.ruler/ruler.toml': `default_agents = ["cursor"]

[agents.cursor.mcp_servers.bad_command]
command = 123

[agents.cursor.mcp_servers.command_with_headers]
command = "node"
headers = { Authorization = "Bearer token" }

[agents.cursor.mcp_servers.url_with_env]
url = "https://example.com/mcp"
env = { API_KEY = "secret" }

[agents.cursor.mcp_servers.missing_target]
args = ["missing-command"]
`,
    });

    const output = runRulerAll('apply', testProject.projectRoot);

    expect(output).toContain('MCP_AGENT_INVALID_SERVER');
    expect(output).toContain(
      "MCP server 'bad_command' for agent 'cursor' must have a string command or url",
    );
    expect(output).toContain(
      "MCP server 'missing_target' for agent 'cursor' must have at least one of command or url",
    );
    expect(output).toContain('MCP_AGENT_FIELD_CONFLICT');
    expect(output).toContain(
      "MCP server 'command_with_headers' for agent 'cursor' has headers with command",
    );
    expect(output).toContain(
      "MCP server 'url_with_env' for agent 'cursor' has env with url",
    );
  });
});
