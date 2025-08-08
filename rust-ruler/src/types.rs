use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

pub const ERROR_PREFIX: &str = "[ruler:error]";

/// Configuration for a specific agent as defined in ruler.toml
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AgentConfig {
    pub enabled: Option<bool>,
    pub output_path: Option<String>,
    pub output_path_instructions: Option<String>,
    pub output_path_config: Option<String>,
    pub mcp: Option<McpConfig>,
}

/// MCP configuration for an agent or global
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct McpConfig {
    pub enabled: Option<bool>,
    #[serde(rename = "merge_strategy")]
    pub strategy: Option<McpStrategy>,
}

/// MCP merge strategy
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum McpStrategy {
    Merge,
    Overwrite,
}

/// Global MCP configuration section
pub type GlobalMcpConfig = McpConfig;

/// Gitignore configuration for automatic .gitignore file updates
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct GitignoreConfig {
    pub enabled: Option<bool>,
}

/// Parsed ruler configuration values
#[derive(Deserialize, Serialize, Debug)]
pub struct RulerConfig {
    pub default_agents: Option<Vec<String>>,
    pub agents: Option<HashMap<String, AgentConfig>>,
    pub mcp: Option<GlobalMcpConfig>,
    pub gitignore: Option<GitignoreConfig>,
}

/// Output path type for agents
#[derive(Debug, Clone)]
pub enum OutputPath {
    Single(PathBuf),
    Multiple(HashMap<String, PathBuf>),
}

/// Loaded configuration with resolved values
#[derive(Debug)]
pub struct LoadedConfig {
    pub default_agents: Option<Vec<String>>,
    pub agent_configs: HashMap<String, AgentConfig>,
    pub cli_agents: Option<Vec<String>>,
    pub mcp: Option<GlobalMcpConfig>,
    pub gitignore: Option<GitignoreConfig>,
}

/// Options for loading the ruler configuration
#[derive(Debug)]
pub struct ConfigOptions {
    pub project_root: PathBuf,
    pub config_path: Option<PathBuf>,
    pub cli_agents: Option<Vec<String>>,
}

/// Error helper function for consistent error formatting
pub fn create_ruler_error(message: &str, context: &str) -> anyhow::Error {
    anyhow::anyhow!("{}: {}", message, context)
}

/// Verbose logging helper
pub fn log_verbose(message: &str, verbose: bool) {
    if verbose {
        println!("[ruler:verbose] {}", message);
    }
}
