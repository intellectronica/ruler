// Simple stub implementations for all remaining agents
use anyhow::Result;
use std::path::Path;
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};

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
                _concatenated_rules: &str,
                _project_root: &Path,
                _ruler_mcp_json: Option<&Value>,
                _agent_config: Option<&AgentConfig>,
            ) -> Result<()> {
                // TODO: Implement
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
