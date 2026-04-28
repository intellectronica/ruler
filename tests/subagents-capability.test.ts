import { IAgent } from '../src/agents/IAgent';
import { ClaudeAgent } from '../src/agents/ClaudeAgent';
import { CursorAgent } from '../src/agents/CursorAgent';
import { CodexCliAgent } from '../src/agents/CodexCliAgent';
import { CopilotAgent } from '../src/agents/CopilotAgent';
import { WindsurfAgent } from '../src/agents/WindsurfAgent';
import { AiderAgent } from '../src/agents/AiderAgent';
import { GeminiCliAgent } from '../src/agents/GeminiCliAgent';

describe('supportsNativeSubagents capability flag', () => {
  describe('agents with a native subagent primitive', () => {
    it('Claude Code reports true', () => {
      const agent: IAgent = new ClaudeAgent();
      expect(agent.supportsNativeSubagents?.()).toBe(true);
    });

    it('Cursor reports true', () => {
      const agent: IAgent = new CursorAgent();
      expect(agent.supportsNativeSubagents?.()).toBe(true);
    });

    it('Codex CLI reports true', () => {
      const agent: IAgent = new CodexCliAgent();
      expect(agent.supportsNativeSubagents?.()).toBe(true);
    });

    it('GitHub Copilot reports true', () => {
      const agent: IAgent = new CopilotAgent();
      expect(agent.supportsNativeSubagents?.()).toBe(true);
    });
  });

  describe('agents without a native subagent primitive', () => {
    it('Windsurf does not report true (instruction/rule/workflow only)', () => {
      const agent: IAgent = new WindsurfAgent();
      expect(agent.supportsNativeSubagents?.() ?? false).toBe(false);
    });

    it('Aider does not report true', () => {
      const agent: IAgent = new AiderAgent();
      expect(agent.supportsNativeSubagents?.() ?? false).toBe(false);
    });

    it('Gemini CLI does not report true', () => {
      const agent: IAgent = new GeminiCliAgent();
      expect(agent.supportsNativeSubagents?.() ?? false).toBe(false);
    });
  });
});
