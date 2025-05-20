# Implementation Plan: Ruler V1.0

This document outlines the steps to implement Version 1.0 of the Ruler application.

## Phase 0: Project Setup & Initial Tooling

* **Task 0.1:** Initialize GitHub Repository
    * Create a new public repository on GitHub (e.g., `intellectronica/ruler`).
    * Add a `.gitignore` file (Node.js template).
    * Add a `LICENSE` file (e.g., MIT).
* **Task 0.2:** Initialize TypeScript Project
    * Run `npm init -y` to create `package.json`.
    * Set `name` to `@intellectronica/ruler`, `version` to `0.1.0`.
    * Install TypeScript: `npm install typescript --save-dev`.
    * Initialize `tsconfig.json`: `npx tsc --init`. Configure `outDir` (e.g., `./dist`), `rootDir` (e.g., `./src`), `target` (e.g., `ES2020`), `module` (e.g., `CommonJS`), `esModuleInterop`, `strict`, etc.
* **Task 0.3:** Setup Linter and Formatter
    * Install ESLint & Prettier: `npm install eslint prettier eslint-config-prettier eslint-plugin-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin --save-dev`.
    * Configure ESLint (`.eslintrc.js`) and Prettier (`.prettierrc.js`).
    * Add npm scripts for linting and formatting (e.g., `lint`, `format`).
* **Task 0.4:** Setup Testing Framework
    * Choose and install a testing framework (e.g., Jest or Vitest): `npm install jest @types/jest ts-jest --save-dev` (for Jest).
    * Configure Jest (`jest.config.js`) to work with TypeScript.
    * Add npm script for testing (e.g., `test`, `test:watch`).
* **Task 0.5:** Define Project Directory Structure
    ```
    /
    ├── .git/
    ├── .github/
    │   └── workflows/
    │       └── ci.yml
    │       └── release.yml
    ├── .vscode/ (optional, for recommended extensions/settings)
    ├── dist/ (compiled JS, not committed if building in CI)
    ├── node_modules/
    ├── src/
    │   ├── agents/
    │   │   ├── IAgent.ts
    │   │   ├── CopilotAgent.ts
    │   │   ├── ClaudeAgent.ts
    │   │   ├── CodexCliAgent.ts
    │   │   ├── CursorAgent.ts
    │   │   ├── WindsurfAgent.ts
    │   │   ├── ClineAgent.ts
    │   │   ├── AiderAgent.ts
    │   ├── core/
    │   │   ├── FileSystemUtils.ts
    │   │   ├── RuleProcessor.ts
    │   ├── cli/
    │   │   ├── index.ts (CLI entry point)
    │   │   └── commands.ts
    │   └── lib.ts (main library entry point, exports core functionality)
    ├── tests/
    │   ├── unit/
    │   │   ├── core/
    │   │   └── agents/
    │   └── e2e/
    │       └── ruler.test.ts
    ├── .eslintignore
    ├── .eslintrc.js
    ├── .gitignore
    ├── .prettierignore
    ├── .prettierrc.js
    ├── jest.config.js
    ├── LICENSE
    ├── package-lock.json
    ├── package.json
    ├── README.md
    └── tsconfig.json
    ```
* **Task 0.6:** Basic CLI Argument Parsing Setup
    * Install a CLI argument parser: `npm install yargs` or `npm install commander`.
    * `npm install @types/yargs --save-dev` if using yargs.
    * Setup a basic command structure in `src/cli/index.ts`.

## Phase 1: Core Library Development (Est. 3-5 days)

* **Module 1.1: File System Utilities (`src/core/FileSystemUtils.ts`)**
    * Implement `findRulerDir(startPath: string): Promise<string | null>`: Searches upwards from `startPath` for a `.ruler` directory. (For V1, assume `startPath` is project root, or implement robust root finding e.g. find `.git` folder).
    * Implement `readMarkdownFiles(rulerDir: string): Promise<{path: string, content: string}[]>`: Recursively finds all `.md` files in `rulerDir`, reads their content. Sort files alphabetically by path.
    * Implement `writeGeneratedFile(filePath: string, content: string): Promise<void>`: Writes content to a file, creating parent directories if necessary.
    * Implement `backupFile(filePath: string): Promise<void>`: Creates a backup of a file (e.g., `file.ext` -> `file.ext.bak`).
    * Unit tests for these utilities (using `memfs` or mocking `fs`).
* **Module 1.2: Rule Processing (`src/core/RuleProcessor.ts`)**
    * Implement `concatenateRules(files: {path: string, content: string}[]): string`: Concatenates content from files into a single string, adding source markers.
    * Unit tests for rule concatenation.
* **Module 1.3: Agent Interface Definition (`src/agents/IAgent.ts`)**
    * Define the `IAgent` interface:
        ```typescript
        export interface IAgent {
          getName(): string;
          applyRulerConfig(concatenatedRules: string, projectRoot: string): Promise<void>;
        }
        ```
* **Module 1.4: Main Orchestrator (`src/lib.ts` and potentially a `RulerApp.ts` class)**
    * Function/class to initialize and manage agent handlers.
    * Main function `applyAllAgentConfigs(projectRoot: string): Promise<void>`:
        1.  Calls `findRulerDir` to locate `/.ruler/`.
        2.  Calls `readMarkdownFiles` to get rule file contents.
        3.  Calls `concatenateRules` to process them.
        4.  Iterates through registered/all agent handlers and calls `applyRulerConfig` on each.
    * Ensure `/.ruler/generated/` directory is created if agents write there.
    * Basic logging of steps.

## Phase 2: AI Agent Adapter Implementation (Est. 5-7 days, 0.5-1 day per agent)

For each agent (GitHub Copilot, Claude Code, OpenAI Codex CLI, Cursor, Windsurf, Cline, Aider):

* **Task 2.X.1: Confirm Configuration Strategy & Path**
    * Verify the method of applying rules (direct file write vs. generated MD file for reference).
    * Confirm target file paths (e.g., `PROJECT_ROOT/AGENTS.md` for Codex CLI, `PROJECT_ROOT/.ruler/generated/<agent>_instructions.md` for others).
* **Task 2.X.2: Implement `AgentNameAgent.ts` (`src/agents/`)**
    * Create a class (e.g., `CodexCliAgent`) implementing `IAgent`.
    * `getName()`: returns agent's name (e.g., "OpenAI Codex CLI").
    * `applyRulerConfig(concatenatedRules: string, projectRoot: string)`:
        * Construct the target path for the rules.
        * For direct writes (Codex CLI):
            * Backup existing file if it exists.
            * Write `concatenatedRules` to the target file.
        * For generated files:
            * Ensure `/.ruler/generated/` exists.
            * Write `concatenatedRules` to `/.ruler/generated/<agent_name>_instructions.md`.
        * Log actions taken.
* **Task 2.X.3: Unit Tests for `AgentNameAgent`**
    * Mock file system interactions (`fs`).
    * Verify correct file paths are determined.
    * Verify correct content is written.
    * Verify backup mechanism if applicable.

**Agent-Specific Notes:**
* **OpenAI Codex CLI:** Implement logic to write to `<repo root>/AGENTS.md`. Ensure backup of original.
* **Others (Copilot, Claude, Cursor, Windsurf, Cline, Aider):** Implement logic to write to `/.ruler/generated/<agent_name>_instructions.md`.

## Phase 3: CLI Implementation (Est. 2-3 days)

* **Module 3.1: CLI Entry Point & Argument Parsing (`src/cli/index.ts`)**
    * Add `#!/usr/bin/env node` shebang.
    * Use `yargs` (or `commander`) to define commands.
    * Initial command: `ruler apply` (or just `ruler` if `apply` is default).
    * Option for `--project-root <path>` (defaults to `process.cwd()`).
    * Help messages (`--help`).
* **Module 3.2: CLI Command Logic (`src/cli/commands.ts`)**
    * `apply` command handler:
        * Determine project root.
        * Call the main orchestration function from the core library (e.g., `applyAllAgentConfigs(projectRoot)`).
* **Module 3.3: User Feedback & Logging**
    * Use a simple logger (e.g., `console.log` with prefixes, or `chalk` for colors).
    * Log actions: "Reading rules from ...", "Applying rules for GitHub Copilot...", "Wrote ...".
    * Log errors clearly.

## Phase 4: Testing (Est. 3-4 days, concurrent with development where possible)

* **Task 4.1: Augment Unit Test Suite**
    * Ensure all core functions, utility functions, and agent handlers have comprehensive unit tests.
    * Aim for high code coverage (e.g., >80%).
* **Task 4.2: Develop End-to-End (Integration) Test Suite (`tests/e2e/`)**
    * Create test scripts that run the compiled CLI.
    * Set up fixture directories:
        * A sample project with a `/.ruler/` directory and some `.md` files.
        * Mock locations for AI agent configurations (e.g., a temporary directory structure).
    * Tests should:
        1.  Run `ruler apply` within the fixture project.
        2.  Verify that the target agent configuration files (or generated `.md` files) are created/updated correctly with the concatenated content.
        3.  Verify output messages from the CLI.
    * Use Node.js `child_process` to run the CLI.
    * Clean up created files/directories after tests.

## Phase 5: Build, Packaging & CI/CD (Est. 2-3 days)

* **Task 5.1: Configure TypeScript Build Process**
    * Ensure `tsconfig.json` (`outDir`) is correct for `tsc` compilation.
    * Add a `build` script to `package.json`: `tsc`.
* **Task 5.2: Prepare `package.json` for Publishing**
    * `name`: `@intellectronica/ruler`
    * `version`: `1.0.0` (for first release)
    * `description`: "A CLI tool to manage custom rules and config across different AI coding agents."
    * `main`: `dist/lib.js` (entry point for the library)
    * `bin`: `{ "ruler": "dist/cli/index.js" }` (for the CLI command)
    * `files`: `["dist", "README.md", "LICENSE"]` (files to include in the npm package)
    * `keywords`: ["ai", "developer-tools", "copilot", "codex", "claude", "cursor", "aider", "config", "rules", "automation"]
    * `author`, `repository`, `bugs`, `homepage` fields.
    * `scripts`: `prepare` (e.g., `npm run build`).
* **Task 5.3: Setup GitHub Actions for CI (`.github/workflows/ci.yml`)**
    * Trigger on push to `main`/`master` and pull requests.
    * Steps:
        1.  Checkout code.
        2.  Setup Node.js (e.g., versions 18.x, 20.x).
        3.  Install dependencies (`npm ci`).
        4.  Run linter (`npm run lint`).
        5.  Run tests (`npm test`).
        6.  Run build (`npm run build`).
* **Task 5.4: Setup GitHub Actions for CD (`.github/workflows/release.yml`)**
    * Trigger on creating a new GitHub release (or pushing a tag like `v*.*.*`).
    * Steps:
        1.  Checkout code.
        2.  Setup Node.js.
        3.  Install dependencies.
        4.  Run build.
        5.  Publish to npm:
            * Use `npm publish --access public`.
            * Requires `NPM_TOKEN` secret in GitHub repository settings.

## Phase 6: Documentation (Est. 1-2 days)

* **Task 6.1: Write `README.md`**
    * Project description.
    * Features.
    * Installation instructions (`npm install -g @intellectronica/ruler` or `npx @intellectronica/ruler`).
    * Usage:
        * How to set up `/.ruler/` directory.
        * CLI commands and options (`ruler apply`).
        * Details for each supported AI agent (where rules are placed, any manual steps required by the user).
    * Contributing guidelines (brief).
    * License.
* **Task 6.2: Add Code Comments & JSDoc**
    * Ensure public APIs, complex functions, and interfaces are well-documented using JSDoc/TSDoc comments.

## Timeline & Milestones (High-Level)

* **Week 1-2:** Phase 0 (Project Setup), Phase 1 (Core Library - basic file reading, concatenation, agent interface).
* **Week 2-3:** Phase 2 (Implement 2-3 key agent adapters, e.g., Codex CLI, one generic file generator).
* **Week 3-4:** Phase 2 (Remaining agent adapters), Phase 3 (CLI Implementation).
* **Week 4-5:** Phase 4 (Intensive Testing - unit and E2E), refine existing code.
* **Week 5-6:** Phase 5 (Build & CI/CD), Phase 6 (Documentation), final testing.
* **Milestone 1 (End of Week 2):** Core library functional. `/.ruler/` files can be read and concatenated. Basic agent interface exists. One agent (e.g., OpenAI Codex CLI or a generic file output) POC working.
* **Milestone 2 (End of Week 4):** All V1 agent adapters implemented. CLI `apply` command is functional.
* **Milestone 3 (End of Week 5):** Comprehensive test suite (unit & E2E) in place. CI pipeline established.
* **Milestone 4 (End of Week 6):** Full documentation (README) written. CD pipeline for npm publishing tested. Ready for V1.0.0 release.

This plan assumes a competent junior developer working mostly full-time on this project, with access to guidance for complex parts. Adjustments may be needed based on actual progress and challenges encountered, especially during the research and implementation of individual agent adapters.
