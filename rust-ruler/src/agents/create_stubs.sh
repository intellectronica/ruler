#!/bin/bash

agents=(
    "cursor:Cursor:.cursor/rules/ruler_cursor_instructions.mdc"
    "windsurf:Windsurf:.windsurf/rules/ruler_windsurf_instructions.md" 
    "cline:Cline:.clinerules"
    "aider:Aider:ruler_aider_instructions.md"
    "firebase:Firebase Studio:.idx/airules.md"
    "openhands:Open Hands:.openhands/microagents/repo.md"
    "gemini_cli:Gemini CLI:GEMINI.md"
    "jules:Jules:AGENTS.md"
    "junie:Junie:.junie/guidelines.md"
    "augmentcode:AugmentCode:.augment/rules/ruler_augment_instructions.md"
    "kilocode:KiloCode:.kilocode/rules/ruler_kilocode_instructions.md"
    "opencode:OpenCode:AGENTS.md"
    "goose:Goose:.goosehints"
    "crush:Crush:CRUSH.md"
    "amp:Amp:AGENT.md"
)

for agent_info in "${agents[@]}"; do
    IFS=':' read -r agent_id agent_name default_path <<< "$agent_info"
    struct_name="${agent_id^}Agent"
    struct_name="${struct_name/_Cli/CliAgent}"
    
    cat > "${agent_id}.rs" << EOL
use anyhow::Result;
use std::path::Path;
use serde_json::Value;
use crate::agents::Agent;
use crate::types::{AgentConfig, OutputPath};

pub struct ${struct_name};

impl Agent for ${struct_name} {
    fn identifier(&self) -> &'static str {
        "${agent_id//_/-}"
    }

    fn name(&self) -> &'static str {
        "${agent_name}"
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
        OutputPath::Single(project_root.join("${default_path}"))
    }
}
EOL
done
