import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { applyHandler, initHandler, revertHandler } from './handlers';

/**
 * Sets up and parses CLI commands.
 */
export function run(): void {
  yargs(hideBin(process.argv))
    .scriptName('ruler')
    .usage('$0 <command> [options]')
    .command(
      'apply',
      'Apply ruler configurations to supported AI agents',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        });
        y.option('agents', {
          type: 'string',
          description:
            'Comma-separated list of agent identifiers: amp, copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush',
        });
        y.option('config', {
          type: 'string',
          description: 'Path to TOML configuration file',
        });
        y.option('mcp', {
          type: 'boolean',
          description: 'Enable or disable applying MCP server config',
          default: true,
        });
        y.alias('mcp', 'with-mcp');
        y.option('mcp-overwrite', {
          type: 'boolean',
          description: 'Replace (not merge) the native MCP config(s)',
          default: false,
        });
        y.option('gitignore', {
          type: 'boolean',
          description:
            'Enable/disable automatic .gitignore updates (default: enabled)',
        });
        y.option('verbose', {
          type: 'boolean',
          description: 'Enable verbose logging',
          default: false,
        });
        y.alias('verbose', 'v');
        y.option('dry-run', {
          type: 'boolean',
          description: 'Preview changes without writing files',
          default: false,
        });
        y.option('local-only', {
          type: 'boolean',
          description:
            'Only search for local .ruler directories, ignore global config',
          default: false,
        });
      },
      applyHandler,
    )
    .command(
      'init',
      'Scaffold a .ruler directory with default files',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        }).option('global', {
          type: 'boolean',
          description:
            'Initialize in global config directory (XDG_CONFIG_HOME/ruler)',
          default: false,
        });
      },
      initHandler,
    )
    .command(
      'revert',
      'Revert ruler configurations by restoring backups and removing generated files',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        });
        y.option('agents', {
          type: 'string',
          description:
            'Comma-separated list of agent identifiers: amp, copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush',
        });
        y.option('config', {
          type: 'string',
          description: 'Path to TOML configuration file',
        });
        y.option('keep-backups', {
          type: 'boolean',
          description: 'Keep backup files (.bak) after restoration',
          default: false,
        });
        y.option('verbose', {
          type: 'boolean',
          description: 'Enable verbose logging',
          default: false,
        });
        y.alias('verbose', 'v');
        y.option('dry-run', {
          type: 'boolean',
          description: 'Preview changes without actually reverting files',
          default: false,
        });
        y.option('local-only', {
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
