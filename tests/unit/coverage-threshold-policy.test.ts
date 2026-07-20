type CoverageMetric = 'statements' | 'branches' | 'functions' | 'lines';

type CoverageThreshold = Record<CoverageMetric, number>;

interface JestCoverageConfig {
  coverageThreshold?: Record<string, Partial<CoverageThreshold>>;
}

const jestConfig = require('../../jest.config') as JestCoverageConfig;

const requiredCoverageThresholds: Record<string, CoverageThreshold> = {
  global: {
    statements: 90,
    branches: 80,
    functions: 90,
    lines: 90,
  },
  './src/core/**/*.ts': {
    statements: 80,
    branches: 72,
    functions: 78,
    lines: 80,
  },
  './src/mcp/**/*.ts': {
    statements: 96,
    branches: 79,
    functions: 100,
    lines: 96,
  },
  './src/agents/AiderAgent.ts': {
    statements: 97,
    branches: 93,
    functions: 87,
    lines: 97,
  },
  './src/agents/FirebenderAgent.ts': {
    statements: 98,
    branches: 92,
    functions: 100,
    lines: 98,
  },
  './src/agents/QwenCodeAgent.ts': {
    statements: 87,
    branches: 81,
    functions: 77,
    lines: 87,
  },
  './src/agents/RooCodeAgent.ts': {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
  './src/agents/ZedAgent.ts': {
    statements: 97,
    branches: 84,
    functions: 100,
    lines: 97,
  },
};

describe('coverage threshold policy', () => {
  it('keeps critical source areas protected by scoped thresholds', () => {
    const configuredThresholds = jestConfig.coverageThreshold ?? {};

    for (const [scope, minimums] of Object.entries(
      requiredCoverageThresholds,
    )) {
      const configuredMinimums = configuredThresholds[scope] ?? {};

      for (const [metric, expectedMinimum] of Object.entries(minimums) as [
        CoverageMetric,
        number,
      ][]) {
        expect(configuredMinimums[metric]).toBeGreaterThanOrEqual(
          expectedMinimum,
        );
      }
    }
  });
});
