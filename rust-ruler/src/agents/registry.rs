use crate::agents::agent_trait::Agent;
use crate::agents::*;

/// Get all available agents
pub fn get_all_agents() -> Vec<Box<dyn Agent>> {
    vec![
        Box::new(copilot::CopilotAgent),
        Box::new(claude::ClaudeAgent),
        Box::new(codex_cli::CodexCliAgent),
        Box::new(cursor::CursorAgent),
        Box::new(windsurf::WindsurfAgent),
        Box::new(stubs::AiderAgent),
        Box::new(stubs::AmpAgent),
        Box::new(stubs::AugmentCodeAgent),
        Box::new(stubs::ClineAgent),
        Box::new(stubs::CrushAgent),
        Box::new(stubs::FirebaseAgent),
        Box::new(stubs::GeminiCliAgent),
        Box::new(stubs::GooseAgent),
        Box::new(stubs::JulesAgent),
        Box::new(stubs::JunieAgent),
        Box::new(stubs::KiloCodeAgent),
        Box::new(stubs::OpenCodeAgent),
        Box::new(stubs::OpenHandsAgent),
    ]
}
