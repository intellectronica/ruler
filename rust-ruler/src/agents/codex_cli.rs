use anyhow::Result;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath, McpStrategy};
use crate::core::filesystem::{backup_file, write_generated_file, ensure_dir_exists};
use crate::mcp::propagate::propagate_mcp_to_agent;

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

        if mcp_enabled && ruler_mcp_json.is_some() {
            // Get the merge strategy from agent config, defaulting to merge
            let strategy = agent_config
                .and_then(|c| c.mcp.as_ref().and_then(|m| m.strategy.clone()))
                .unwrap_or(McpStrategy::Merge);

            // Use the new MCP propagation system
            if let Err(e) = propagate_mcp_to_agent(
                "codex",
                ruler_mcp_json.unwrap(),
                project_root,
                strategy,
            ) {
                eprintln!("Warning: Failed to propagate MCP config for Codex CLI: {}", e);
            }
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
