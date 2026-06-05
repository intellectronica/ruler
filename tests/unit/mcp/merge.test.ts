import { mergeMcp } from '../../../src/mcp/merge';

describe('mergeMcp', () => {
  it('normalises all recognised server containers into the requested key', () => {
    const result = mergeMcp(
      {
        otherSetting: true,
        servers: {
          fromServers: { url: 'https://servers.example.com' },
          duplicate: { url: 'https://servers-wins.example.com' },
        },
        mcpServers: {
          fromMcpServers: { command: 'node' },
          duplicate: { url: 'https://mcpservers.example.com' },
        },
        mcp: {
          fromMcp: { url: 'https://mcp.example.com' },
        },
      },
      {
        mcpServers: {
          incoming: { command: 'incoming' },
          duplicate: { url: 'https://incoming.example.com' },
        },
      },
      'merge',
      'servers',
    );

    expect(result).toEqual({
      otherSetting: true,
      servers: {
        fromMcp: { url: 'https://mcp.example.com' },
        fromMcpServers: { command: 'node' },
        fromServers: { url: 'https://servers.example.com' },
        duplicate: { url: 'https://incoming.example.com' },
        incoming: { command: 'incoming' },
      },
    });
  });

  it('normalises incoming server containers when overwriting', () => {
    const result = mergeMcp(
      {
        otherSetting: true,
        servers: {
          stale: { command: 'old' },
        },
      },
      {
        mcp: {
          fromMcp: { command: 'mcp' },
        },
        mcpServers: {
          fromMcpServers: { command: 'mcpServers' },
        },
      },
      'overwrite',
      'servers',
    );

    expect(result).toEqual({
      otherSetting: true,
      servers: {
        fromMcp: { command: 'mcp' },
        fromMcpServers: { command: 'mcpServers' },
      },
    });
  });
});
