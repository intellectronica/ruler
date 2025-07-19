import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CodexCliAgent } from '../../../src/agents/CodexCliAgent';
import { CursorAgent } from '../../../src/agents/CursorAgent';
import { WindsurfAgent } from '../../../src/agents/WindsurfAgent';
import { ClineAgent } from '../../../src/agents/ClineAgent';
import { AiderAgent } from '../../../src/agents/AiderAgent';
import { KiloCodeAgent } from '../../../src/agents/KiloCodeAgent';

describe('Agent Lowercase Identifiers', () => {
  const expectedIdentifiers = {
    copilot: CopilotAgent,
    claude: ClaudeAgent,
    codex: CodexCliAgent,
    cursor: CursorAgent,
    windsurf: WindsurfAgent,
    cline: ClineAgent,
    aider: AiderAgent,
    kilocode: KiloCodeAgent,
  };

  describe('Agent.getIdentifier() returns lowercase identifiers', () => {
    Object.entries(expectedIdentifiers).forEach(([expectedId, AgentClass]) => {
      it(`${AgentClass.name} returns "${expectedId}"`, () => {
        const agent = new AgentClass();
        expect(agent.getIdentifier()).toBe(expectedId);
      });
    });
  });

  describe('Agent.getName() returns display names', () => {
    const expectedDisplayNames = {
      copilot: 'GitHub Copilot',
      claude: 'Claude Code',
      codex: 'OpenAI Codex CLI',
      cursor: 'Cursor',
      windsurf: 'Windsurf',
      cline: 'Cline',
      aider: 'Aider',
      kilocode: 'Kilo Code'
    };

    Object.entries(expectedIdentifiers).forEach(([identifier, AgentClass]) => {
      it(`${AgentClass.name} returns "${expectedDisplayNames[identifier as keyof typeof expectedDisplayNames]}"`, () => {
        const agent = new AgentClass();
        expect(agent.getName()).toBe(expectedDisplayNames[identifier as keyof typeof expectedDisplayNames]);
      });
    });
  });
});