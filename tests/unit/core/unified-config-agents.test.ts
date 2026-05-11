import * as path from 'path';
import { loadUnifiedConfig } from '../../../src/core/UnifiedConfigLoader';

/**
 * Fixture uses integration/fixtures/unified with ruler.toml specifying default_agents=["alpha","beta"].
 * We'll simulate CLI override selecting only beta.
 */

describe('UnifiedConfigLoader agent resolution', () => {
  const projectRoot = path.join(__dirname, '../../integration/fixtures/agents');
  test('enables TOML default agents when no CLI override', async () => {
    const unified = await loadUnifiedConfig({ projectRoot });
    expect(unified.toml.defaultAgents).toEqual(['alpha','beta']);
    expect(unified.agents.alpha?.enabled).toBe(true);
    expect(unified.agents.beta?.enabled).toBe(true);
    // Non-listed agent should be absent or disabled
    expect(unified.agents.gamma).toBeUndefined();
  });
  test('CLI agents override defaults', async () => {
    const unified = await loadUnifiedConfig({ projectRoot, cliAgents: ['beta'] });
    expect(unified.agents.alpha?.enabled).toBeFalsy();
    expect(unified.agents.beta?.enabled).toBe(true);
  });
});
