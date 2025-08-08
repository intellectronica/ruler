use anyhow::Result;
use std::path::Path;
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};

pub struct WindsurfAgent;

impl Agent for WindsurfAgent {
    fn identifier(&self) -> &'static str {
        "windsurf"
    }

    fn name(&self) -> &'static str {
        "Windsurf"
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
        OutputPath::Single(project_root.join(".windsurf").join("rules").join("ruler_windsurf_instructions.md"))
    }

    fn mcp_server_key(&self) -> &'static str {
        "servers"
    }
}
