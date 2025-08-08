// Simple stub implementations for all remaining agents
use anyhow::Result;
use std::path::{Path, PathBuf};
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};
use crate::core::filesystem::{backup_file, write_generated_file, ensure_dir_exists};

macro_rules! simple_agent {
    ($name:ident, $id:literal, $display:literal, $path:literal) => {
        pub struct $name;
        
        impl Agent for $name {
            fn identifier(&self) -> &'static str {
                $id
            }
            
            fn name(&self) -> &'static str {
                $display
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
                        _ => unreachable!("Agent should have single output path"),
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
                OutputPath::Single(project_root.join($path))
            }
            
            fn mcp_server_key(&self) -> &'static str {
                "servers"
            }
        }
    };
}

simple_agent!(ClineAgent, "cline", "Cline", ".clinerules");
simple_agent!(AiderAgent, "aider", "Aider", "ruler_aider_instructions.md");
simple_agent!(FirebaseAgent, "firebase", "Firebase Studio", ".idx/airules.md");
simple_agent!(OpenHandsAgent, "openhands", "Open Hands", ".openhands/microagents/repo.md");
simple_agent!(GeminiCliAgent, "gemini-cli", "Gemini CLI", "GEMINI.md");
simple_agent!(JulesAgent, "jules", "Jules", "AGENTS.md");
simple_agent!(JunieAgent, "junie", "Junie", ".junie/guidelines.md");
simple_agent!(AugmentCodeAgent, "augmentcode", "AugmentCode", ".augment/rules/ruler_augment_instructions.md");
simple_agent!(KiloCodeAgent, "kilocode", "KiloCode", ".kilocode/rules/ruler_kilocode_instructions.md");
simple_agent!(OpenCodeAgent, "opencode", "OpenCode", "AGENTS.md");
simple_agent!(GooseAgent, "goose", "Goose", ".goosehints");
simple_agent!(CrushAgent, "crush", "Crush", "CRUSH.md");
simple_agent!(AmpAgent, "amp", "Amp", "AGENT.md");
