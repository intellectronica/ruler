import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { applyAllAgentConfigs } from '../lib';

/**
 * Sets up and parses CLI commands.
 */
export function run(): void {
  yargs(hideBin(process.argv))
    .scriptName('ruler')
    .usage('$0 <command> [options]')
    .command(
      'apply',
      'Apply ruler configurations to all supported AI agents',
      (y) => {
        y.option('project-root', {
          type: 'string',
          description: 'Project root directory',
          default: process.cwd(),
        });
      },
      async (argv) => {
        const projectRoot = argv['project-root'] as string;
        try {
          await applyAllAgentConfigs(projectRoot);
          console.log('Ruler apply completed successfully.');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('Error applying ruler configurations:', message);
          process.exit(1);
        }
      },
    )
    .demandCommand(1, 'You need to specify a command')
    .help()
    .strict()
    .parse();
}
