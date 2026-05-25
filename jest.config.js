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
