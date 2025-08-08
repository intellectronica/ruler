use anyhow::Result;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};
use crate::core::filesystem::{backup_file, write_generated_file, ensure_dir_exists};

pub struct CodexCliAgent;

impl Agent for CodexCliAgent {
    fn identifier(&self) -> &'static str {
        "codex"
    }

    fn name(&self) -> &'static str {
        "OpenAI Codex CLI"
    }

    fn apply_config(
        &self,
        concatenated_rules: &str,
        project_root: &Path,
        ruler_mcp_json: Option<&Value>,
        agent_config: Option<&AgentConfig>,
    ) -> Result<()> {
        // Get default paths
        let default_paths = match self.default_output_path(project_root) {
            OutputPath::Multiple(paths) => paths,
            _ => unreachable!("CodexCliAgent should have multiple output paths"),
        };

        // Determine the instructions file path
        let instructions_path = agent_config
            .and_then(|c| c.output_path.as_ref().or(c.output_path_instructions.as_ref()))
            .map(PathBuf::from)
            .unwrap_or_else(|| default_paths.get("instructions").unwrap().clone());

        // Write the instructions file
        backup_file(&instructions_path)?;
        write_generated_file(&instructions_path, concatenated_rules)?;

        // Handle MCP configuration (always enabled for now to match TypeScript behavior)
        let mcp_enabled = agent_config
            .and_then(|c| c.mcp.as_ref().and_then(|m| m.enabled))
            .unwrap_or(true);

        if mcp_enabled {
            // Determine the config file path
            let config_path = agent_config
                .and_then(|c| c.output_path_config.as_ref())
                .map(PathBuf::from)
                .unwrap_or_else(|| default_paths.get("config").unwrap().clone());

            // Ensure the parent directory exists
            if let Some(parent) = config_path.parent() {
                ensure_dir_exists(parent)?;
            }

            // For now, create a basic MCP config with default example server
            // This matches the default mcp.json content from init command
            let default_mcp_config = r#"
[mcp_servers.example]
command = "node"
args = ["/path/to/mcp-server.js"]
env = { NODE_ENV = "production" }
"#.trim();

            // TODO: In Phase 3, implement full MCP server merging from ruler_mcp_json
            // For now, just create the basic config to match TypeScript behavior
            write_generated_file(&config_path, default_mcp_config)?;
        }

        Ok(())
    }

    fn default_output_path(&self, project_root: &Path) -> OutputPath {
        let mut paths = HashMap::new();
        paths.insert("instructions".to_string(), project_root.join("AGENTS.md"));
        paths.insert("config".to_string(), project_root.join(".codex").join("config.toml"));
        OutputPath::Multiple(paths)
    }

    fn mcp_server_key(&self) -> &'static str {
        "servers"
    }
}
