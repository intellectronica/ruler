use anyhow::Result;
use std::path::{Path, PathBuf};
use serde_json::Value;
use crate::types::{AgentConfig, OutputPath};

/// Trait defining an AI agent configuration adapter
pub trait Agent {
    /// Returns the lowercase identifier of the agent (e.g., "copilot", "claude", "aider")
    fn identifier(&self) -> &'static str;

    /// Returns the display name of the agent
    fn name(&self) -> &'static str;

    /// Applies the concatenated ruler rules to the agent's configuration
    fn apply_config(
        &self,
        concatenated_rules: &str,
        project_root: &Path,
        ruler_mcp_json: Option<&Value>,
        agent_config: Option<&AgentConfig>,
    ) -> Result<()>;

    /// Returns the default output path for this agent (implemented by agents)
    fn default_output_path(&self, project_root: &Path) -> OutputPath;

    /// Returns the MCP server key for the agent (used for MCP configuration)
    fn mcp_server_key(&self) -> &'static str;
}
