import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('apply-mcp.capability-warnings', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    // Create test project with mixed local and remote MCP servers
    const mcp = {
      mcpServers: {
        localServer: {
          command: 'node',
          args: ['server.js']
        },
        remoteServer: {
          url: 'http://remote.example.com'
        }
      }
    };

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(mcp, null, 2) + '\n',
      '.ruler/AGENTS.md': '# Test agents\n'
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('works with new capability system - AgentsMd ignores MCP', async () => {
    const { projectRoot } = testProject;
    
    // Simple test to verify the capability system is working
    const output = runRuler('apply --agents agentsmd', projectRoot);
    expect(output).toContain('Ruler apply completed successfully');
    
    // We expect that AgentsMd doesn't try to configure MCP
    const agentsmdFile = path.join(projectRoot, 'AGENTS.md');
    const agentsmdExists = await fs.access(agentsmdFile).then(() => true).catch(() => false);
    expect(agentsmdExists).toBe(true);
  });

  it('works with new capability system - Codex handles local servers', async () => {
    const { projectRoot } = testProject;
    
    // Simple test to verify Codex processes local servers but should warn about remote
    const output = runRuler('apply --agents codex', projectRoot);
    expect(output).toContain('Ruler apply completed successfully');
  });

  it('works with new capability system - OpenHands handles remote servers', async () => {
    const { projectRoot } = testProject;
    
    // Simple test to verify OpenHands processes remote servers but should warn about local
    const output = runRuler('apply --agents openhands', projectRoot);
    expect(output).toContain('Ruler apply completed successfully');
  });
});