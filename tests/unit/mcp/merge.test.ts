import { mergeMcp } from '../../../src/mcp/merge';

describe('mergeMcp', () => {
  it('removes alternate server aliases when writing the target key', () => {
    const result = mergeMcp(
      {
        mcp: {
          existing: { command: 'existing-command' },
        },
        otherSetting: true,
      },
      {
        mcpServers: {
          incoming: { command: 'incoming-command' },
        },
      },
      'merge',
      'servers',
    );

    expect(result).toEqual({
      otherSetting: true,
      servers: {
        existing: { command: 'existing-command' },
        incoming: { command: 'incoming-command' },
      },
    });
  });
});
