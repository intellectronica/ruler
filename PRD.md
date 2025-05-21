# Product Requirements Document: Ruler V1.0

## 1. Introduction

Ruler is a command-line application designed to help developers manage and synchronise custom rules and configurations across various AI coding agents. By defining rules in a centralised location (`/.ruler/`), users can ensure consistent behaviour and instruction sets for their AI tools, streamlining their development workflow. This document outlines the requirements for Version 1.0 of Ruler.

## 2. Goals and Objectives

* **Centralisation:** Provide a single source of truth for custom AI agent instructions and configurations within a project.
* **Automation:** Automate the process of disseminating these rules to supported AI coding agents.
* **Consistency:** Help ensure AI agents operate with a consistent set of guidelines and context across a developer's toolkit.
* **Extensibility:** Build a system that can be easily extended to support more AI agents and more complex rule harmonisation in the future.
* **Ease of Use:** Offer a simple and intuitive command-line interface for developers.

## 3. Target Audience

* Software developers who use multiple AI coding assistants.
* Developers who want to maintain consistent coding styles, project context, and custom instructions across their AI tools.
* Teams that want to share a common set of AI agent configurations for a project.

## 4. Scope (Version 1.0)

### 4.1. In Scope

* **Rule Discovery:** Read all Markdown (`.md`) files from the `/.ruler/` directory located at the project root.
* **Rule Collection & Processing:**
    * Concatenate the content of all found `.md` files into a single block of text.
    * The order of concatenation will be alphabetical based on filenames.
    * Each original file's content will be clearly demarcated in the concatenated output (e.g., using a separator and a comment indicating the source filename).
* **AI Agent Configuration:**
    * Distribute the collected rules to the relevant locations or formats for the following AI agents:
        * GitHub Copilot
        * Claude Code
        * OpenAI Codex CLI
        * Cursor
        * Windsurf
        * Cline
        * Aider
    * The method of "applying" configuration will vary by agent (see Functional Requirements FR3).
* **Core Library:** All core functionality will be available as a TypeScript library (`@intellectronica/ruler`).
* **CLI:**
    * A command-line interface callable via `npx @intellectronica/ruler apply` (or similar command) to trigger the rule application process.
    * The CLI will be the primary way users interact with Ruler in V1.
* **Extensibility (Agent Interface):**
    * Each AI agent's integration logic will be encapsulated in its own class.
    * All agent classes will implement a common `IAgent` interface, ensuring a consistent way to manage and add new agents.
* **Testing:** A comprehensive test suite including unit tests and end-to-end integration tests.
* **Packaging & Distribution:**
    * The tool will be packaged as an npm package under the name `@intellectronica/ruler`.
    * Automated builds and releases to npm via GitHub Actions.

### 4.2. Out of Scope (for Version 1.0)

* **Bi-directional Synchronisation:** Reading configurations *from* AI agents back into the central `/.ruler/` store (harmonisation).
* **Advanced Rule Management:** Support for configuration file formats other than Markdown (e.g., JSON, YAML) within `/.ruler/` for defining rules.
* **AI-Powered Editing:** Using Large Language Models (LLMs) to intelligently edit or transform rules.
* **Graphical User Interface (GUI):** Only a CLI will be provided.
* **Real-time Monitoring/Updates:** Ruler will operate on-demand via CLI execution, not as a background service.
* **Complex Rule Conflict Resolution:** If different files in `/.ruler/` contain conflicting instructions, V1 will simply concatenate them; conflict resolution is manual.

## 5. Functional Requirements

### FR1: Rule Discovery
* Ruler MUST search for a directory named `.ruler` at the root of the current project (e.g., the Git repository root).
* Ruler MUST read all files with a `.md` extension from the `/.ruler/` directory and its subdirectories.

### FR2: Rule Collection & Processing
* Ruler MUST concatenate the content of all discovered `.md` files.
* The concatenation order MUST be alphabetical by the full path of the `.md` files.
* Each concatenated section MUST be clearly marked with its source file, for example:
    ```markdown
    ---
    Source: /.ruler/style_guide.md
    ---
    [Content of style_guide.md]

    ---
    Source: /.ruler/typescript/best_practices.md
    ---
    [Content of typescript/best_practices.md]
    ```
* A `/.ruler/generated/` directory MAY be created to store generated files if it doesn't exist.

### FR3: AI Agent Configuration
Ruler will apply the collected rules to supported AI agents by placing or modifying configuration files directly in the locations expected by each agent.

* **FR3.1: GitHub Copilot**
    * Ruler WILL generate a single Markdown file named `copilot-instructions.md` containing the concatenated rules.
    * This file WILL be placed in the `<repo root>/.github/` directory. Ruler WILL create the `.github` directory if it does not exist.
    * If `<repo root>/.github/copilot-instructions.md` already exists, Ruler WILL first create a backup (e.g., `copilot-instructions.md.bak`) and then overwrite it.
    * Documentation WILL note this direct placement.
* **FR3.2: Claude Code**
    * Ruler WILL generate a single Markdown file named `CLAUDE.md` containing the concatenated rules.
    * This file WILL be placed at the project repository root (i.e., `<repo root>/CLAUDE.md`).
    * If `<repo root>/CLAUDE.md` already exists, Ruler WILL first create a backup (e.g., `CLAUDE.md.bak`) and then overwrite it.
    * Documentation WILL note this direct placement.
* **FR3.3: OpenAI Codex CLI**
    * Ruler WILL write the concatenated rules directly to an `AGENTS.md` file. This file MUST be placed at the project repository root (i.e., `<repo root>/AGENTS.md`), which is a standard location recognized by OpenAI Codex CLI.
    * If the `AGENTS.md` file does not exist at this location, Ruler WILL create it.
    * If `AGENTS.md` already exists, Ruler WILL first create a backup of the existing file (e.g., renaming it to `AGENTS.md.bak`) and then WILL overwrite the original `AGENTS.md` with the new, Ruler-generated content. The content will be clearly marked.
    * Ruler will not use the `/.ruler/generated/` directory for OpenAI Codex CLI configuration files.
* **FR3.4: Cursor**
    * Ruler WILL generate a single Markdown file (e.g., `ruler_cursor_instructions.md`) containing the concatenated rules.
    * This file WILL be placed in the `<repo root>/.cursor/rules/` directory. Ruler WILL create the `.cursor` and `.cursor/rules` directories if they do not exist.
    * If `<repo root>/.cursor/rules/ruler_cursor_instructions.md` (or the chosen filename) already exists, Ruler WILL first create a backup and then overwrite it.
    * Documentation WILL note this direct placement.
* **FR3.5: Windsurf**
    * Ruler WILL generate a single Markdown file (e.g., `ruler_windsurf_instructions.md`) containing the concatenated rules.
    * This file WILL be placed in the `<repo root>/.windsurf/rules/` directory. Ruler WILL create the `.windsurf` and `.windsurf/rules` directories if they do not exist.
    * If `<repo root>/.windsurf/rules/ruler_windsurf_instructions.md` (or the chosen filename) already exists, Ruler WILL first create a backup and then overwrite it.
    * Documentation WILL note this direct placement.
* **FR3.6: Cline**
    * Ruler WILL generate a file named `.clinerules` containing the concatenated rules.
    * This file WILL be placed at the project repository root (i.e., `<repo root>/.clinerules`).
    * If `<repo root>/.clinerules` already exists, Ruler WILL first create a backup (e.g., `.clinerules.bak`) and then overwrite it.
    * Documentation WILL note this direct placement.
* **FR3.7: Aider**
    * Ruler WILL generate a single Markdown file (e.g., `ruler_aider_instructions.md`) containing the concatenated rules. This file WILL be placed at the project repository root (i.e., `<repo root>/ruler_aider_instructions.md`).
    * Ruler WILL then ensure this generated Markdown file is listed in the `read:` section of the Aider configuration file (`<repo root>/.aider.conf.yml`).
    * If `<repo root>/.aider.conf.yml` exists:
        * Ruler WILL create a backup (e.g., `.aider.conf.yml.bak`).
        * Ruler WILL parse the YAML file. If the `read:` key exists and is a list, Ruler WILL add `ruler_aider_instructions.md` to this list (if not already present). If the `read:` key exists but is not a list, or if the key does not exist, Ruler WILL create/replace the `read:` key with a list containing `ruler_aider_instructions.md`.
        * Ruler WILL write the modified YAML content back to `<repo root>/.aider.conf.yml`.
    * If `<repo root>/.aider.conf.yml` does not exist, Ruler WILL create it with a `read:` key and `ruler_aider_instructions.md` listed under it.
    * Documentation WILL explain this automated setup.

### FR4: Extensibility (Agent Interface)
* An interface (e.g., `IAgent`) MUST be defined, specifying methods like `getName(): string` and `applyRulerConfig(concatenatedRules: string): Promise<void>`.
* Each supported AI agent's logic MUST be implemented in a separate class that adheres to this interface.

## 6. Non-Functional Requirements

* **NFR1: Usability (CLI)**
    * The CLI MUST provide clear feedback to the user about its actions (e.g., files read, agents processed, files written).
    * Error messages MUST be informative and help users troubleshoot issues.
* **NFR2: Performance**
    * For typical project sizes (dozens of rule files, few hundred KBs of text), the `apply` command should complete within a few seconds.
* **NFR3: Reliability**
    * Ruler MUST correctly identify and process `.md` files.
    * File operations (writing to agent config locations) MUST be handled safely, ideally with backups of existing agent-specific files if they are being directly overwritten (e.g., for Codex CLI's `AGENTS.md`).
* **NFR4: Testability**
    * The codebase MUST be structured to allow for comprehensive unit testing of individual modules and agent handlers.
    * End-to-end tests MUST validate the CLI's behavior and its effect on mock agent configuration environments.
* **NFR5: Maintainability**
    * Code MUST be well-documented (comments, JSDoc).
    * The architecture (especially the agent interface and separation of concerns) SHOULD make it straightforward to add support for new agents or modify existing ones.
* **NFR6: Packaging & Distribution**
    * Ruler MUST be installable via `npm install -g @intellectronica/ruler` and runnable using `npx @intellectronica/ruler`.
    * The npm package MUST include all necessary dependencies and compiled JavaScript.

## 7. Technical Design Considerations

* **Language & Platform:** TypeScript, Node.js environment.
* **Library First Approach:** The core logic should be a self-contained library, with the CLI acting as a consumer of this library. This facilitates reusability and testing.
* **Future-Proofing:** While V1 features are limited, the design of agent interfaces and rule processing should allow for future enhancements (like supporting other config formats or bi-directional sync) without major refactoring.

## 8. Success Metrics

* The `@intellectronica/ruler` package is successfully published to npm and installable.
* The `apply` command functions correctly for all specified AI agents as per their defined interaction model.
* Test coverage (unit and E2E) is above 80%.
* Developers can successfully centralise their AI agent rules using Ruler.

## 9. Open Questions / Areas for Further Research

* **Definitive Config Paths for Windsurf & Cline:** If more direct integration methods (beyond generating an MD file for manual use) are discovered for Windsurf and Cline, these should be prioritised.
* **Agent Detection:** Should Ruler attempt to detect which AI agents are actively used or configured in a project, or simply apply rules for all known agents, letting the output be ignored if an agent isn't in use? (For V1, apply for all; user can choose which generated files to use).
* **Backup Strategy for Direct Writes:** For agents like Codex CLI where a file is directly written, establish a simple backup mechanism (e.g., `AGENTS.md` -> `AGENTS.md.bak`).
