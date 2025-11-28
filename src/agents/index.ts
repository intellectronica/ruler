import { IAgent } from './IAgent';
import { AbstractAgent } from './AbstractAgent';
import { CopilotAgent } from './CopilotAgent';
import { ClaudeAgent } from './ClaudeAgent';
import { CodexCliAgent } from './CodexCliAgent';
import { CursorAgent } from './CursorAgent';
import { WindsurfAgent } from './WindsurfAgent';
import { ClineAgent } from './ClineAgent';
import { AiderAgent } from './AiderAgent';
import { FirebaseAgent } from './FirebaseAgent';
import { OpenHandsAgent } from './OpenHandsAgent';
import { GeminiCliAgent } from './GeminiCliAgent';
import { JulesAgent } from './JulesAgent';
import { JunieAgent } from './JunieAgent';
import { AugmentCodeAgent } from './AugmentCodeAgent';
import { KiloCodeAgent } from './KiloCodeAgent';
import { OpenCodeAgent } from './OpenCodeAgent';
import { CrushAgent } from './CrushAgent';
import { GooseAgent } from './GooseAgent';
import { AmpAgent } from './AmpAgent';
import { ZedAgent } from './ZedAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import { QwenCodeAgent } from './QwenCodeAgent';
import { KiroAgent } from './KiroAgent';
import { WarpAgent } from './WarpAgent';
import { RooCodeAgent } from './RooCodeAgent';
import { TraeAgent } from './TraeAgent';
import { AmazonQCliAgent } from './AmazonQCliAgent';
import { FirebenderAgent } from './FirebenderAgent';
import { AntigravityAgent } from './AntigravityAgent';

export { AbstractAgent };

export const allAgents: IAgent[] = [
  new CopilotAgent(),
  new ClaudeAgent(),
  new CodexCliAgent(),
  new CursorAgent(),
  new WindsurfAgent(),
  new ClineAgent(),
  new AiderAgent(),
  new FirebaseAgent(),
  new OpenHandsAgent(),
  new GeminiCliAgent(),
  new JulesAgent(),
  new JunieAgent(),
  new AugmentCodeAgent(),
  new KiloCodeAgent(),
  new OpenCodeAgent(),
  new GooseAgent(),
  new CrushAgent(),
  new AmpAgent(),
  new ZedAgent(),
  new QwenCodeAgent(),
  new AgentsMdAgent(),
  new KiroAgent(),
  new WarpAgent(),
  new RooCodeAgent(),
  new TraeAgent(),
  new AmazonQCliAgent(),
  new FirebenderAgent(),
  new AntigravityAgent(),
];

/**
 * Generates a comma-separated list of agent identifiers for CLI help text.
 * Returns identifiers in alphabetical order, with 'agentsmd' always first.
 */
export function getAgentIdentifiersForCliHelp(): string {
  const identifiers = allAgents.map((agent) => agent.getIdentifier());
  const sorted = identifiers.sort();

  // Ensure agentsmd is first (it should already be first alphabetically, but let's be explicit)
  const agentsMdIndex = sorted.indexOf('agentsmd');
  if (agentsMdIndex > 0) {
    const agentsmd = sorted.splice(agentsMdIndex, 1)[0];
    sorted.unshift(agentsmd);
  }

  return sorted.join(', ');
}
