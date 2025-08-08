use anyhow::Result;
use std::path::Path;
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};

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
        _concatenated_rules: &str,
        _project_root: &Path,
        _ruler_mcp_json: Option<&Value>,
        _agent_config: Option<&AgentConfig>,
    ) -> Result<()> {
        // TODO: Implement
        Ok(())
    }

    fn default_output_path(&self, project_root: &Path) -> OutputPath {
        OutputPath::Single(project_root.join("AGENTS.md"))
    }

    fn mcp_server_key(&self) -> &'static str {
        "servers"
    }
}
