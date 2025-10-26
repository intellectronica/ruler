import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { applyHandler, initHandler, revertHandler } from './handlers';
import { ApplyArgs, InitArgs, RevertArgs } from './handlers';
import { getAgentIdentifiersForCliHelp } from '../agents/index';

/**
 * Sets up and parses CLI commands.
 */
export function run(): void {
  yargs(hideBin(process.argv))
    .scriptName('ruler')
    .usage('$0 <command> [options]')
    .command<ApplyArgs>(
      'apply',
      'Apply ruler configurations to supported AI agents',
      (y: Argv) => {
        return y
          .option('project-root', {
            type: 'string',
            description: 'Project root directory',
            default: process.cwd(),
          })
          .option('agents', {
            type: 'string',
            description: `Comma-separated list of agent identifiers: ${getAgentIdentifiersForCliHelp()}`,
          })
          .option('config', {
            type: 'string',
            description: 'Path to TOML configuration file',
          })
          .option('mcp', {
            type: 'boolean',
            description: 'Enable or disable applying MCP server config',
            default: true,
          })
          .alias('mcp', 'with-mcp')
          .option('mcp-overwrite', {
            type: 'boolean',
            description: 'Replace (not merge) the native MCP config(s)',
            default: false,
          })
          .option('gitignore', {
            type: 'boolean',
            description:
              'Enable/disable automatic .gitignore updates (default: enabled)',
          })
          .option('verbose', {
            type: 'boolean',
            description: 'Enable verbose logging',
            default: false,
          })
          .alias('verbose', 'v')
          .option('dry-run', {
            type: 'boolean',
            description: 'Preview changes without writing files',
            default: false,
          })
          .option('local-only', {
            type: 'boolean',
            description:
              'Only search for local .ruler directories, ignore global config',
            default: false,
          })
          .option('nested', {
            type: 'boolean',
            description:
              'Enable nested rule loading from nested .ruler directories (default: from config or disabled)',
          })
          .option('backup', {
            type: 'boolean',
            description:
              'Enable/disable creation of .bak backup files (default: enabled)',
            default: true,
          })
          .option('skills', {
            type: 'boolean',
            description:
              'Enable/disable skills support (experimental, default: enabled)',
          });
      },
      applyHandler,
    )
    .command<InitArgs>(
      'init',
      'Scaffold a .ruler directory with default files',
      (y: Argv) => {
        return y
          .option('project-root', {
            type: 'string',
            description: 'Project root directory',
            default: process.cwd(),
          })
          .option('global', {
            type: 'boolean',
            description:
              'Initialize in global config directory (XDG_CONFIG_HOME/ruler)',
            default: false,
          });
      },
      initHandler,
    )
    .command<RevertArgs>(
      'revert',
      'Revert ruler configurations from supported AI agents',
      (y: Argv) => {
        return y
          .option('project-root', {
            type: 'string',
            description: 'Project root directory',
            default: process.cwd(),
          })
          .option('agents', {
            type: 'string',
            description: `Comma-separated list of agent identifiers: ${getAgentIdentifiersForCliHelp()}`,
          })
          .option('config', {
            type: 'string',
            description: 'Path to TOML configuration file',
          })
          .option('keep-backups', {
            type: 'boolean',
            description: 'Keep backup files after revert',
            default: false,
          })
          .option('verbose', {
            type: 'boolean',
            description: 'Enable verbose logging',
            default: false,
          })
          .alias('verbose', 'v')
          .option('dry-run', {
            type: 'boolean',
            description: 'Preview changes without writing files',
            default: false,
          })
          .option('local-only', {
            type: 'boolean',
            description:
              'Only search for local .ruler directories, ignore global config',
            default: false,
          });
      },
      revertHandler,
    )
    .demandCommand(1, 'You need to specify a command')
    .help()
    .strict()
    .parse();
}
