/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.{test,spec}.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
    './src/cli/commands.ts': {
      statements: 80,
      functions: 80,
      lines: 80,
    },
    './src/cli/index.ts': {
      statements: 100,
      functions: 100,
      lines: 100,
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
  },
  // Build the project once before all tests run to prevent race conditions
  globalSetup: './jest.setup.js',
  // CI environments can be slower, especially for integration tests that invoke a build
  // step (e.g. `npm run build`) before running assertions. The default Jest timeout of
  // 5 seconds is sometimes not enough, which leads to flaky failures in the pipeline
  // even though the tests pass locally. Increase the default timeout to make the CI
  // more robust while still keeping developers aware of excessively long-running tests.
  testTimeout: 30000,
};
