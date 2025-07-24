import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import {
  readVSCodeSettings,
  writeVSCodeSettings,
  transformRulerToAugmentMcp,
  mergeAugmentMcpServers,
  getVSCodeSettingsPath,
} from '../vscode/settings';

/**
 * AugmentCode agent adapter.
 * Generates ruler_augment_instructions.md configuration file and updates VSCode settings.json with MCP server configuration.
 */
export class AugmentCodeAgent implements IAgent {
  getIdentifier(): string {
    return 'augmentcode';
  }

  getName(): string {
    return 'AugmentCode';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await backupFile(output);
    await writeGeneratedFile(output, concatenatedRules);

    if (rulerMcpJson) {
      const settingsPath = getVSCodeSettingsPath(projectRoot);
      await backupFile(settingsPath);

      const existingSettings = await readVSCodeSettings(settingsPath);
      const augmentServers = transformRulerToAugmentMcp(rulerMcpJson);
      const mergedSettings = mergeAugmentMcpServers(
        existingSettings,
        augmentServers,
        agentConfig?.mcp?.strategy ?? 'merge',
      );

      await writeVSCodeSettings(settingsPath, mergedSettings);
    }
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.augment',
      'rules',
      'ruler_augment_instructions.md',
    );
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }
}
