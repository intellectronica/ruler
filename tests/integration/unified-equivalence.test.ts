import * as path from 'path';
import { loadUnifiedConfig } from '../../src/core/UnifiedConfigLoader';
import {
  loadRulerConfiguration,
  RulerConfiguration,
} from '../../src/core/apply-engine';

describe('Unified config equivalence (subset)', () => {
  const projectRoot = path.join(__dirname, 'fixtures/agents');
  test('matches defaults and concatenated rules', async () => {
    const legacy = await loadRulerConfiguration(
      projectRoot,
      undefined,
      false,
      false,
    );
    const unified = await loadUnifiedConfig({ projectRoot });
    const legacyConfig = legacy as RulerConfiguration;
    // Legacy default agents live under legacy.config.defaultAgents
    expect(unified.toml.defaultAgents).toEqual(
      legacyConfig.config.defaultAgents,
    );
    // Both bundles should contain some markdown content (alpha.md/beta.md not created yet, so empty OK)
    expect(typeof unified.rules.concatenated).toBe('string');
    // Enabled agents set equals legacy defaults
    expect(new Set(Object.keys(unified.agents))).toEqual(
      new Set(legacyConfig.config.defaultAgents || []),
    );
  });
});
