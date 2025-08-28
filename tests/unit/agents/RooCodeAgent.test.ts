import { RooCodeAgent } from '../../../src/agents/RooCodeAgent';

describe('RooCodeAgent Unit Tests', () => {
  let agent: RooCodeAgent;

  beforeEach(() => {
    agent = new RooCodeAgent();
  });

  describe('Basic Properties', () => {
    it('returns correct identifier', () => {
      expect(agent.getIdentifier()).toBe('roo');
    });

    it('returns correct name', () => {
      expect(agent.getName()).toBe('RooCode');
    });

    it('returns correct default output paths', () => {
      const paths = agent.getDefaultOutputPath('/tmp/test');
      expect(paths.instructions).toBe('/tmp/test/AGENTS.md');
      expect(paths.mcp).toBe('/tmp/test/.roo/mcp.json');
    });

    it('supports MCP stdio', () => {
      expect(agent.supportsMcpStdio()).toBe(true);
    });

    it('supports MCP remote', () => {
      expect(agent.supportsMcpRemote()).toBe(true);
    });

    it('returns correct MCP server key', () => {
      expect(agent.getMcpServerKey()).toBe('mcpServers');
    });
  });
});