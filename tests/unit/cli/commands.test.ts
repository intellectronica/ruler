import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createCli, run } from '../../../src/cli/commands';
import {
  applyHandler,
  initHandler,
  revertHandler,
} from '../../../src/cli/handlers';

jest.mock('yargs', () => jest.fn());
jest.mock('yargs/helpers', () => ({
  hideBin: jest.fn((argv: string[]) => argv.slice(2)),
}));
jest.mock('../../../src/cli/handlers', () => ({
  applyHandler: jest.fn(),
  initHandler: jest.fn(),
  revertHandler: jest.fn(),
}));

type CommandDefinition = {
  command: string;
  describe: string;
  builder: (argv: ChainableArgv) => ChainableArgv;
  handler: unknown;
};

type ChainableArgv = {
  alias: jest.Mock<ChainableArgv, [string, string]>;
  command: jest.Mock<
    ChainableArgv,
    [string, string, CommandDefinition['builder'], unknown]
  >;
  demandCommand: jest.Mock<ChainableArgv, [number, string]>;
  help: jest.Mock<ChainableArgv, []>;
  option: jest.Mock<ChainableArgv, [string, Record<string, unknown>]>;
  parse: jest.Mock<void, []>;
  scriptName: jest.Mock<ChainableArgv, [string]>;
  strict: jest.Mock<ChainableArgv, []>;
  usage: jest.Mock<ChainableArgv, [string]>;
  version: jest.Mock<ChainableArgv, [string]>;
};

function createMockArgv(commands: CommandDefinition[]): ChainableArgv {
  const argv = {} as ChainableArgv;
  argv.alias = jest.fn<ChainableArgv, [string, string]>(() => argv);
  argv.command = jest.fn((command, describe, builder, handler) => {
    commands.push({ command, describe, builder, handler });
    return argv;
  });
  argv.demandCommand = jest.fn<ChainableArgv, [number, string]>(() => argv);
  argv.help = jest.fn<ChainableArgv, []>(() => argv);
  argv.option = jest.fn<ChainableArgv, [string, Record<string, unknown>]>(
    () => argv,
  );
  argv.parse = jest.fn<void, []>();
  argv.scriptName = jest.fn<ChainableArgv, [string]>(() => argv);
  argv.strict = jest.fn<ChainableArgv, []>(() => argv);
  argv.usage = jest.fn<ChainableArgv, [string]>(() => argv);
  argv.version = jest.fn<ChainableArgv, [string]>(() => argv);
  return argv;
}

describe('CLI command wiring', () => {
  let commands: CommandDefinition[];
  let argv: ChainableArgv;

  beforeEach(() => {
    commands = [];
    argv = createMockArgv(commands);
    jest.clearAllMocks();
    (yargs as unknown as jest.Mock).mockReturnValue(argv);
  });

  it('creates a strict parser with the package version', () => {
    createCli(['apply']);

    expect(yargs).toHaveBeenCalledWith(['apply']);
    expect(argv.scriptName).toHaveBeenCalledWith('ruler');
    expect(argv.version).toHaveBeenCalledWith(
      expect.stringMatching(/^\d+\.\d+\.\d+/),
    );
    expect(argv.demandCommand).toHaveBeenCalledWith(
      1,
      'You need to specify a command',
    );
    expect(argv.strict).toHaveBeenCalled();
  });

  it('registers and configures apply options', () => {
    createCli(['apply']);
    const applyCommand = commands.find((entry) => entry.command === 'apply');
    expect(applyCommand?.handler).toBe(applyHandler);

    const applyArgv = createMockArgv([]);
    applyCommand?.builder(applyArgv);

    expect(applyArgv.option).toHaveBeenCalledWith(
      'project-root',
      expect.objectContaining({ type: 'string' }),
    );
    expect(applyArgv.option).toHaveBeenCalledWith(
      'mcp-overwrite',
      expect.objectContaining({ type: 'boolean' }),
    );
    expect(applyArgv.option).toHaveBeenCalledWith(
      'subagents',
      expect.objectContaining({ type: 'boolean' }),
    );
    expect(applyArgv.alias).toHaveBeenCalledWith('mcp', 'with-mcp');
    expect(applyArgv.alias).toHaveBeenCalledWith('verbose', 'v');
  });

  it('registers and configures init options', () => {
    createCli(['init']);
    const initCommand = commands.find((entry) => entry.command === 'init');
    expect(initCommand?.handler).toBe(initHandler);

    const initArgv = createMockArgv([]);
    initCommand?.builder(initArgv);

    expect(initArgv.option).toHaveBeenCalledWith(
      'project-root',
      expect.objectContaining({ type: 'string' }),
    );
    expect(initArgv.option).toHaveBeenCalledWith(
      'global',
      expect.objectContaining({ type: 'boolean' }),
    );
  });

  it('registers and configures revert options', () => {
    createCli(['revert']);
    const revertCommand = commands.find((entry) => entry.command === 'revert');
    expect(revertCommand?.handler).toBe(revertHandler);

    const revertArgv = createMockArgv([]);
    revertCommand?.builder(revertArgv);

    expect(revertArgv.option).toHaveBeenCalledWith(
      'keep-backups',
      expect.objectContaining({ type: 'boolean' }),
    );
    expect(revertArgv.option).toHaveBeenCalledWith(
      'local-only',
      expect.objectContaining({ type: 'boolean' }),
    );
    expect(revertArgv.alias).toHaveBeenCalledWith('verbose', 'v');
  });

  it('parses hidden process arguments from run', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'ruler', 'apply'];

    try {
      run();
    } finally {
      process.argv = originalArgv;
    }

    expect(hideBin).toHaveBeenCalledWith(['node', 'ruler', 'apply']);
    expect(yargs).toHaveBeenCalledWith(['apply']);
    expect(argv.parse).toHaveBeenCalledTimes(1);
  });
});
