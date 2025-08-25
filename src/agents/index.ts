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
];
