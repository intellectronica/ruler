import { CustomCommandsConfig, CustomCommand } from '../types';

/**
 * Processes custom commands and generates appropriate content for different agents.
 */
export class CommandProcessor {
  /**
   * Generates fallback instruction text for agents that don't support native commands.
   * This adds explicit instructions to the ruler content for handling custom commands.
   */
  static generateFallbackInstructions(commands: CustomCommandsConfig): string {
    if (!commands || Object.keys(commands).length === 0) {
      return '';
    }

    const commandInstructions = Object.entries(commands)
      .map(([commandId, command]) => {
        const trigger = command.type === 'slash' ? `/${commandId}` : commandId;
        return [
          `## Custom Command: ${command.name}`,
          `**Trigger**: ${trigger}`,
          `**Description**: ${command.description}`,
          '',
          `When the user sends "${trigger}", respond with the following:`,
          '',
          command.prompt,
          '',
        ].join('\n');
      })
      .join('\n');

    return [
      '',
      '',
      '<!-- Custom Commands Section -->',
      '',
      '# Custom Commands',
      '',
      'The following custom commands are available in this project:',
      '',
      commandInstructions,
    ].join('\n');
  }

  /**
   * Validates a custom command configuration.
   */
  static validateCommand(commandId: string, command: CustomCommand): string[] {
    const errors: string[] = [];

    if (!command.name || command.name.trim() === '') {
      errors.push(`Command '${commandId}' is missing a name`);
    }

    if (!command.description || command.description.trim() === '') {
      errors.push(`Command '${commandId}' is missing a description`);
    }

    if (!command.prompt || command.prompt.trim() === '') {
      errors.push(`Command '${commandId}' is missing a prompt`);
    }

    if (
      command.type &&
      !['slash', 'workflow', 'prompt-file', 'instruction'].includes(
        command.type,
      )
    ) {
      errors.push(`Command '${commandId}' has invalid type '${command.type}'`);
    }

    return errors;
  }

  /**
   * Validates an entire custom commands configuration.
   */
  static validateCommands(commands: CustomCommandsConfig): string[] {
    const errors: string[] = [];

    for (const [commandId, command] of Object.entries(commands)) {
      if (!commandId || commandId.trim() === '') {
        errors.push('Command ID cannot be empty');
        continue;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(commandId)) {
        errors.push(
          `Command ID '${commandId}' contains invalid characters. Use only letters, numbers, hyphens, and underscores.`,
        );
      }

      errors.push(...this.validateCommand(commandId, command));
    }

    return errors;
  }

  /**
   * Generates VS Code prompt file content for Copilot.
   * See: https://code.visualstudio.com/docs/copilot/customization/prompt-files
   */
  static generateCopilotPromptFiles(
    commands: CustomCommandsConfig,
  ): Record<string, string> {
    const files: Record<string, string> = {};

    for (const [commandId, command] of Object.entries(commands)) {
      const fileName = `.github/copilot/prompts/${commandId}.md`;
      const content = [
        `---`,
        `title: ${command.name}`,
        `description: ${command.description}`,
        `---`,
        '',
        command.prompt,
      ].join('\n');

      files[fileName] = content;
    }

    return files;
  }

  /**
   * Generates Claude Code slash commands configuration.
   * See: https://docs.anthropic.com/en/docs/claude-code/slash-commands#custom-slash-commands
   */
  static generateClaudeSlashCommands(commands: CustomCommandsConfig): string {
    const slashCommands = Object.entries(commands)
      .filter(([, command]) => !command.type || command.type === 'slash')
      .map(([commandId, command]) => {
        return [
          `## /${commandId} - ${command.name}`,
          '',
          command.description,
          '',
          '```',
          command.prompt,
          '```',
          '',
        ].join('\n');
      });

    if (slashCommands.length === 0) {
      return '';
    }

    return [
      '',
      '',
      '<!-- Custom Slash Commands -->',
      '',
      '# Custom Slash Commands',
      '',
      ...slashCommands,
    ].join('\n');
  }

  /**
   * Generates Cursor commands configuration.
   * See: https://docs.cursor.com/en/agent/chat/commands
   */
  static generateCursorCommands(commands: CustomCommandsConfig): string {
    const cursorCommands = Object.entries(commands).map(
      ([commandId, command]) => {
        return [
          `## @${commandId} - ${command.name}`,
          '',
          `**Description**: ${command.description}`,
          '',
          '**Behavior**:',
          command.prompt,
          '',
        ].join('\n');
      },
    );

    if (cursorCommands.length === 0) {
      return '';
    }

    return [
      '',
      '',
      '<!-- Custom Commands -->',
      '',
      '# Custom Commands',
      '',
      'The following custom commands are available:',
      '',
      ...cursorCommands,
    ].join('\n');
  }

  /**
   * Generates Windsurf workflows configuration.
   * See: https://docs.windsurf.com/windsurf/cascade/workflows
   */
  static generateWindsurfWorkflows(commands: CustomCommandsConfig): string {
    const workflows = Object.entries(commands)
      .filter(([, command]) => command.type === 'workflow')
      .map(([commandId, command]) => {
        return [
          `## Workflow: ${command.name}`,
          '',
          `**Trigger**: ${commandId}`,
          `**Description**: ${command.description}`,
          '',
          '**Steps**:',
          command.prompt,
          '',
        ].join('\n');
      });

    if (workflows.length === 0) {
      return '';
    }

    return [
      '',
      '',
      '<!-- Custom Workflows -->',
      '',
      '# Custom Workflows',
      '',
      ...workflows,
    ].join('\n');
  }
}
