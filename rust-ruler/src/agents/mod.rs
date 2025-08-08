pub mod agent_trait;
pub mod copilot;
pub mod claude;
pub mod codex_cli;
pub mod cursor;
pub mod windsurf;
pub mod stubs;
pub mod registry;

pub use registry::get_all_agents;
pub use agent_trait::Agent;
