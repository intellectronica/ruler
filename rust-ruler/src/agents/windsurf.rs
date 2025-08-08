use anyhow::Result;
use std::path::{Path, PathBuf};
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};
use crate::core::filesystem::{backup_file, write_generated_file, ensure_dir_exists};

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
        concatenated_rules: &str,
        project_root: &Path,
        _ruler_mcp_json: Option<&Value>,
        agent_config: Option<&AgentConfig>,
    ) -> Result<()> {
        let output_path = match agent_config.and_then(|c| c.output_path.as_ref()) {
            Some(path) => PathBuf::from(path),
            None => match self.default_output_path(project_root) {
                OutputPath::Single(path) => path,
                _ => unreachable!("WindsurfAgent should have single output path"),
            },
        };

        if let Some(parent) = output_path.parent() {
            ensure_dir_exists(parent)?;
        }
        backup_file(&output_path)?;
        write_generated_file(&output_path, concatenated_rules)?;
        Ok(())
    }

    fn default_output_path(&self, project_root: &Path) -> OutputPath {
        OutputPath::Single(project_root.join(".windsurf").join("rules").join("ruler_windsurf_instructions.md"))
    }

    fn mcp_server_key(&self) -> &'static str {
        "servers"
    }
}
