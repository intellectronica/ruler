import * as fs from 'fs-extra';
import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent'; // Import IAgentConfig
import { RulerConfig } from '../config/RulerConfig'; // This might become redundant if rules are pre-concat

/**
 * JulesAgent is responsible for processing and applying rules
 * to generate an AGENTS.md file.
 */
export class JulesAgent implements IAgent {
  private readonly identifier = 'jules';
  private readonly name = 'Jules';
  private readonly defaultOutputFileName = 'AGENTS.md';

  /**
   * Gets the unique identifier for this agent.
   * @returns The agent's identifier.
   */
  getIdentifier(): string {
    return this.identifier;
  }

  /**
   * Gets the display name for this agent.
   * @returns The agent's name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Gets the default output path for the AGENTS.md file.
   * This is typically path.join(projectRoot, 'AGENTS.md').
   * @param projectRoot The root directory of the project.
   * @returns The default output file path.
   */
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, this.defaultOutputFileName);
  }

  /**
   * Applies the given Ruler configuration.
   * This involves concatenating rule descriptions and writing them to the AGENTS.md file.
   * A backup of the existing AGENTS.md file will be created if it exists.
   * @param concatenatedRules The combined rules text, pre-formatted.
   * @param projectRoot The root directory of the project.
   * @param rulerMcpJson The MCP JSON object (currently not used by JulesAgent).
   * @param agentConfig The agent-specific configuration (used for output path override).
   */
  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    _rulerMcpJson: Record<string, unknown> | null, // Mark as unused
    agentConfig?: IAgentConfig,
    processedOutputPaths?: Set<string>,
  ): Promise<void> {
    const outputPath = agentConfig?.outputPath || this.getDefaultOutputPath(projectRoot);

    if (processedOutputPaths && processedOutputPaths.has(outputPath)) {
      console.log(`[JulesAgent] Output path ${outputPath} already processed. Skipping write.`);
      return;
    }
    const backupPath = `${outputPath}.bak`;

    console.log(`Jules will operate on: ${outputPath}`);

    if (fs.existsSync(outputPath)) {
      console.log(`Backing up existing file to: ${backupPath}`);
      fs.copyFileSync(outputPath, backupPath);
    }

    // JulesAgent now expects concatenatedRules to be the full content for its section.
    // The title ## Jules - Agent Rules\n\n is expected to be part of concatenatedRules.
    // If not, the calling code needs to ensure it. For now, we assume it's included.
    console.log(`Writing rules to: ${outputPath}`);
    fs.writeFileSync(outputPath, concatenatedRules);

    if (processedOutputPaths) {
      processedOutputPaths.add(outputPath);
    }
    console.log('Jules has finished processing the rules.');
  }
}
