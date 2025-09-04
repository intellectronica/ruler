import { getAgentIdentifiersForCliHelp, allAgents } from '../../../src/agents/index';

describe('Dynamic CLI Help Agent List', () => {
  it('generates comma-separated list of all agent identifiers', () => {
    const result = getAgentIdentifiersForCliHelp();
    
    // Should be a comma-separated string
    expect(typeof result).toBe('string');
    expect(result).toContain(',');
    
    // Split into array for analysis
    const identifiers = result.split(', ');
    
    // Should contain all agent identifiers
    expect(identifiers.length).toBe(allAgents.length);
    
    // Should contain all actual agent identifiers
    const actualIdentifiers = allAgents.map(agent => agent.getIdentifier());
    for (const identifier of actualIdentifiers) {
      expect(identifiers).toContain(identifier);
    }
  });

  it('lists agentsmd first', () => {
    const result = getAgentIdentifiersForCliHelp();
    const identifiers = result.split(', ');
    
    expect(identifiers[0]).toBe('agentsmd');
  });

  it('lists remaining agents in alphabetical order', () => {
    const result = getAgentIdentifiersForCliHelp();
    const identifiers = result.split(', ');
    
    // Remove agentsmd and check the rest are sorted
    const restOfAgents = identifiers.slice(1);
    const sortedRest = [...restOfAgents].sort();
    
    expect(restOfAgents).toEqual(sortedRest);
  });

  it('contains expected new agents that were missing from hardcoded list', () => {
    const result = getAgentIdentifiersForCliHelp();
    
    // These agents were missing from the hardcoded list but should be included
    const newAgents = ['amazonqcli', 'kiro', 'warp', 'roo', 'augmentcode', 'jules', 'junie', 'goose', 'openhands'];
    
    for (const agent of newAgents) {
      expect(result).toContain(agent);
    }
  });

  it('does not contain duplicate identifiers', () => {
    const result = getAgentIdentifiersForCliHelp();
    const identifiers = result.split(', ');
    
    const uniqueIdentifiers = [...new Set(identifiers)];
    expect(identifiers.length).toBe(uniqueIdentifiers.length);
  });
});