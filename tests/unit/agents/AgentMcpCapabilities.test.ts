import { CodexCliAgent } from '../../../src/agents/CodexCliAgent';
import { OpenHandsAgent } from '../../../src/agents/OpenHandsAgent';
import { AgentsMdAgent } from '../../../src/agents/AgentsMdAgent';
import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';

describe('Agent MCP Capabilities', () => {
  it('CodexCliAgent supports only local MCP servers', () => {
    const agent = new CodexCliAgent();
    expect(agent.supportsMcp?.()).toBe(true);
    expect(agent.supportsLocalMcp?.()).toBe(true);
    expect(agent.supportsRemoteMcp?.()).toBe(false);
  });

  it('OpenHandsAgent supports only remote MCP servers', () => {
    const agent = new OpenHandsAgent();
    expect(agent.supportsMcp?.()).toBe(true);
    expect(agent.supportsLocalMcp?.()).toBe(false);
    expect(agent.supportsRemoteMcp?.()).toBe(true);
  });

  it('AgentsMdAgent does not support MCP at all', () => {
    const agent = new AgentsMdAgent();
    expect(agent.supportsMcp?.()).toBe(false);
    // Local and remote capabilities are irrelevant when MCP is not supported
  });

  it('CopilotAgent supports both local and remote MCP servers (default)', () => {
    const agent = new CopilotAgent();
    expect(agent.supportsMcp?.()).toBe(true);
    expect(agent.supportsLocalMcp?.()).toBe(true);
    expect(agent.supportsRemoteMcp?.()).toBe(true);
  });

  it('ClaudeAgent supports both local and remote MCP servers (default)', () => {
    const agent = new ClaudeAgent();
    expect(agent.supportsMcp?.()).toBe(true);
    expect(agent.supportsLocalMcp?.()).toBe(true);
    expect(agent.supportsRemoteMcp?.()).toBe(true);
  });
});