import { allAgents as libAgents } from '../../../src/lib';
import { allAgents as revertAgents } from '../../../src/revert';
import { CrushAgent } from '../../../src/agents/CrushAgent';
import { IAgent } from '../../../src/agents/IAgent';

describe('Agent Registry', () => {
  it('should have the same agents in lib.ts and revert.ts', () => {
    const libAgentIdentifiers = libAgents
      .map((agent: IAgent) => agent.getIdentifier())
      .sort();
    const revertAgentIdentifiers = revertAgents
      .map((agent: IAgent) => agent.getIdentifier())
      .sort();
    expect(libAgentIdentifiers).toEqual(revertAgentIdentifiers);
  });

  it('revert.ts should include CrushAgent', () => {
    const hasCrushAgent = revertAgents.some(
      (agent: IAgent) => agent instanceof CrushAgent,
    );
    expect(hasCrushAgent).toBe(true);
  });
});
