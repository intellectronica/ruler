const run = jest.fn();

jest.mock('../../../src/cli/commands', () => ({
  run,
}));

describe('CLI entrypoint', () => {
  it('runs the command parser', async () => {
    await import('../../../src/cli/index');

    expect(run).toHaveBeenCalledTimes(1);
  });
});
