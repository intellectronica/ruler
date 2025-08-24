import { getAgentMcpCapabilities, agentSupportsMcp, filterMcpConfigForAgent } from '../../../src/mcp/capabilities';
import { OpenHandsAgent } from '../../../src/agents/OpenHandsAgent';
import { AugmentCodeAgent } from '../../../src/agents/AugmentCodeAgent';
import { CopilotAgent } from '../../../src/agents/CopilotAgent';

describe('MCP Capabilities', () => {
  describe('getAgentMcpCapabilities', () => {
    it('returns correct capabilities for OpenHands (both stdio and remote)', () => {
      const agent = new OpenHandsAgent();
      const capabilities = getAgentMcpCapabilities(agent);
      
      expect(capabilities.supportsStdio).toBe(true);
      expect(capabilities.supportsRemote).toBe(true);
    });

    it('returns correct capabilities for AugmentCode (no MCP support)', () => {
      const agent = new AugmentCodeAgent();
      const capabilities = getAgentMcpCapabilities(agent);
      
      expect(capabilities.supportsStdio).toBe(false);
      expect(capabilities.supportsRemote).toBe(false);
    });

    it('returns correct capabilities for Copilot (both stdio and remote)', () => {
      const agent = new CopilotAgent();
      const capabilities = getAgentMcpCapabilities(agent);
      
      expect(capabilities.supportsStdio).toBe(true);
      expect(capabilities.supportsRemote).toBe(true);
    });
  });

  describe('agentSupportsMcp', () => {
    it('returns true for agents that support MCP', () => {
      expect(agentSupportsMcp(new OpenHandsAgent())).toBe(true);
      expect(agentSupportsMcp(new CopilotAgent())).toBe(true);
    });

    it('returns false for agents that do not support MCP', () => {
      expect(agentSupportsMcp(new AugmentCodeAgent())).toBe(false);
    });
  });

  describe('filterMcpConfigForAgent', () => {
    const testMcpConfig = {
      mcpServers: {
        stdio_server: {
          command: 'npx',
          args: ['-y', 'server-filesystem', '/tmp']
        },
        remote_server: {
          url: 'https://api.example.com/mcp'
        },
        mixed_server: {
          command: 'npx',
          url: 'https://api.example.com/mcp'  // Invalid, but tests edge case
        }
      }
    };

    it('returns all servers for agents that support both stdio and remote', () => {
      const agent = new OpenHandsAgent();
      const filtered = filterMcpConfigForAgent(testMcpConfig, agent);
      
      expect(filtered).not.toBeNull();
      expect(filtered!.mcpServers).toEqual({
        stdio_server: testMcpConfig.mcpServers.stdio_server,
        remote_server: testMcpConfig.mcpServers.remote_server
      });
      // mixed_server should be excluded as it has both command and url
    });

    it('returns null for agents that do not support MCP', () => {
      const agent = new AugmentCodeAgent();
      const filtered = filterMcpConfigForAgent(testMcpConfig, agent);
      
      expect(filtered).toBeNull();
    });

    it('returns null when no servers are provided', () => {
      const agent = new OpenHandsAgent();
      const emptyConfig = { mcpServers: {} };
      const filtered = filterMcpConfigForAgent(emptyConfig, agent);
      
      expect(filtered).toBeNull();
    });

    it('returns null when mcpServers is not present', () => {
      const agent = new OpenHandsAgent();
      const invalidConfig = { somethingElse: {} };
      const filtered = filterMcpConfigForAgent(invalidConfig, agent);
      
      expect(filtered).toBeNull();
    });
  });
});