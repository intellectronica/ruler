### **Requirements: Codex CLI (Rust) MCP Server Integration (Revised)**

#### **1. Introduction**

The goal of this initiative is to extend the `ruler` tool to support the management and propagation of Model Context Protocol (MCP) server configurations for the Rust-based implementation of the OpenAI Codex CLI. This will allow developers to centralise their Codex CLI's MCP settings within their project's local directory, consistent with how other AI coding assistants are managed by `ruler`.

#### **2. Target Configuration File**

* **File Path:** The target configuration file for the Codex CLI (Rust) is `config.toml`.
* **Location:** `ruler` will generate this file locally within the project at `./.codex/config.toml`.
* **User Responsibility:** The user is responsible for making the Codex CLI aware of this local configuration. This can be achieved by:
    1.  Setting the `CODEX_HOME` environment variable to point to the project's local `./.codex` directory.
    2.  Manually copying the generated `./.codex/config.toml` to the global default location (e.g., `~/.config/codex/`).
* **Format:** The file is in TOML format. `ruler` must correctly parse and write to this format, creating the file and parent directories as needed.

#### **3. `ruler`'s Role and Behaviour**

* **Input:** `ruler` will read MCP server definitions from the project's `.ruler/mcp.json` file.
* **Processing:** When the `ruler apply` command is executed and the `codex` agent is active, `ruler` will:
    1.  Read the project-local target `config.toml` file, if it exists.
    2.  Parse the TOML content. If the file does not exist, an empty configuration will be used as the base.
    3.  Read the project's `.ruler/mcp.json` file.
    4.  Merge the servers from `mcp.json` into the `[mcp_servers]` table of the parsed TOML data, respecting the configured MCP strategy (`merge` or `overwrite`).
* **Output:** `ruler` will write the updated configuration back to the `./.codex/config.toml` file.

#### **4. `ruler.toml` Configuration**

Users will control the MCP propagation for the Codex CLI via the project's `.ruler/ruler.toml` file. This includes enabling/disabling the feature, setting the merge strategy, and customising output paths.

**Example `ruler.toml` snippet:**

```toml
# --- Agent-Specific Configurations ---

[agents.codex]
# Enable the agent.
enabled = true

# Path for the primary instructions file (optional).
output_path = "AGENTS.md"

# Path for the MCP TOML configuration file (optional).
output_path_config = ".codex/config.toml"

[agents.codex.mcp]
# Enable MCP propagation for Codex CLI.
enabled = true

# Set the merge strategy: "merge" or "overwrite".
merge_strategy = "merge"
```

#### **5. `CodexCliAgent` Behaviour**

The `CodexCliAgent` adapter will be updated to handle two distinct outputs:
1.  The concatenated markdown instructions file (e.g., `AGENTS.md`).
2.  The MCP `config.toml` file.

This behaviour will be similar to the existing `AiderAgent`.

#### **6. Documentation & `.gitignore`**

The main `README.md` file will be updated to reflect this new capability and explain the user's responsibility regarding the `CODEX_HOME` environment variable. The new output path (`.codex/config.toml`) will be automatically added to the project's `.gitignore` file by `ruler`.

### **Implementation Plan (Revised)**

This plan follows a Test-Driven Development (TDD) methodology.

#### **Phase 1: Testing (TDD)**

1.  **Create New Test File:** Create `tests/unit/agents/CodexCliAgent.test.ts` to test the agent's new capabilities in isolation.

2.  **Test Suite: `CodexCliAgent` MCP Handling**
    * **Test Case 1: Merge Strategy:**
        * **Setup:** In a temporary project directory, create a pre-existing `./.codex/config.toml` with a `native_server`. The project's `.ruler/mcp.json` should have a `ruler_server`.
        * **Action:** Instantiate `CodexCliAgent` and call `applyRulerConfig` with the appropriate parameters and `merge` strategy.
        * **Assertion:** Verify the resulting `./.codex/config.toml` contains both servers in the `[mcp_servers]` table.

    * **Test Case 2: Overwrite Strategy:**
        * **Setup:** Same as the merge test.
        * **Action:** Call `applyRulerConfig` with the `overwrite` strategy.
        * **Assertion:** Verify the resulting `./.codex/config.toml` contains only the `ruler_server`.

    * **Test Case 3: Custom Config Path:**
        * **Setup:** Provide a custom path (e.g., `custom/codex.toml`) via the `agentConfig.outputPathConfig` parameter.
        * **Action:** Call `applyRulerConfig`.
        * **Assertion:** Verify the TOML file is created at the custom path.

    * **Test Case 4 (Regression):** Ensure that the instructions file (`AGENTS.md`) is still written correctly alongside the `config.toml`.

#### **Phase 2: Implementation**

1.  **Add TOML Stringifier Dependency:**
    * Add `@iarna/toml` to `devDependencies` in `package.json` for TOML serialization.
    * Run `npm install --save-dev @iarna/toml @types/iarna__toml`.

2.  **Update `src/agents/CodexCliAgent.ts`:**
    * Modify the class to handle two distinct output paths, similar to `AiderAgent`.
    * Implement `getDefaultOutputPath` to return a record:
        ```typescript
        getDefaultOutputPath(projectRoot: string): Record<string, string> {
          return {
            instructions: path.join(projectRoot, 'AGENTS.md'),
            config: path.join(projectRoot, '.codex', 'config.toml'),
          };
        }
        ```
    * Update `applyRulerConfig`:
        a.  Determine the paths for both the instructions file (`outputPath` or `outputPathInstructions`) and the config file (`outputPathConfig`).
        b.  Write the `concatenatedRules` to the instructions file (existing logic).
        c.  Implement the MCP logic:
            * Check if MCP is enabled for the agent.
            * Get the path for the config file.
            * Read the ruler `mcp.json`.
            * Read and parse the native `config.toml` (if it exists).
            * Adapt the `rulerMcpJson` to use a `mcp_servers` key.
            * Use the existing `mergeMcp` function to combine the server lists based on the strategy.
            * Update the native config object with the merged server list.
            * Stringify the object to TOML and write it to the config file path, ensuring parent directories are created.

3.  **Update `src/lib.ts`:**
    * No changes are expected here. The `getAgentOutputPaths` function is designed to handle agents that return a record from `getDefaultOutputPath`, so it will automatically pick up the new `.codex/config.toml` path for `.gitignore` management.

4.  **Update `src/core/ConfigLoader.ts`:**
    * The existing `agentConfigSchema` already supports `output_path_config`, which can be immediately used for the `codex` agent without changes to the schema itself.

#### **Phase 3: Documentation**

1.  **Update `README.md`:**
    * In the "Supported AI Agents" table, update the "File(s) Created/Updated" column for **OpenAI Codex CLI** to: `AGENTS.md`, `.codex/config.toml (MCP)`.
    * In the `ruler.toml` configuration example, update the `[agents.codex]` section to show both `output_path` and `output_path_config` as configurable options.
    * Add a brief note in the "MCP Server Configuration" section or a new subsection for the Codex CLI, explaining that the user needs to set the `CODEX_HOME` environment variable for the local config to be recognized.

#### **Phase 4: Finalisation and CI Workflow**

1.  **Local Verification:** Run `npm test`, `npm run test:coverage`, and `npm run lint` to ensure all checks pass and the new code is fully tested and formatted.
2.  **Committing and Pushing:** Commit changes and push to a new feature branch (e.g., `feat/codex-cli-local-mcp`).
3.  **Creating a Pull Request:** Use the `gh` tool to open a PR with a clear title and description of the changes.
4.  **Monitoring Continuous Integration:** Monitor the GitHub Actions results using `gh pr checks` and address any failures by repeating the local development cycle.