import { IAgent, IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * GitHub Copilot agent adapter.
 * Writes to AGENTS.md for both web-based GitHub Copilot and VS Code extension.
 */
export class CopilotAgent implements IAgent {
  private agentsMdAgent = new AgentsMdAgent();

  getIdentifier(): string {
    return 'copilot';
  }

  getName(): string {
    return 'GitHub Copilot';
  }

  /**
   * Returns the default output path for AGENTS.md.
   */
  getDefaultOutputPath(projectRoot: string): string {
    return this.agentsMdAgent.getDefaultOutputPath(projectRoot);
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    // Write to AGENTS.md using the existing AgentsMdAgent infrastructure
    await this.agentsMdAgent.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null, // No MCP config needed for the instructions file
      {
        // Preserve explicit outputPath precedence semantics if provided
        outputPath:
          agentConfig?.outputPath || agentConfig?.outputPathInstructions,
      },
      backup,
    );
  }

  getMcpServerKey(): string {
    return 'servers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
