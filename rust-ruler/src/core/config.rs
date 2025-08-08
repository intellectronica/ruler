use anyhow::Result;
use std::path::{Path, PathBuf};
use std::fs;
use std::collections::HashMap;
use crate::types::{RulerConfig, LoadedConfig, ConfigOptions, AgentConfig, create_ruler_error};

/// Loads and parses the ruler TOML configuration file, applying defaults.
/// If the file is missing or invalid, returns empty/default config.
pub fn load_config(options: ConfigOptions) -> Result<LoadedConfig> {
    let config_file = if let Some(config_path) = &options.config_path {
        config_path.clone()
    } else {
        // Try local .ruler/ruler.toml first
        let local_config_file = options.project_root.join(".ruler").join("ruler.toml");
        if local_config_file.exists() {
            local_config_file
        } else {
            // Try global config directory
            let global_config_dir = if let Ok(xdg_config) = std::env::var("XDG_CONFIG_HOME") {
                PathBuf::from(xdg_config)
            } else if let Ok(home) = std::env::var("HOME") {
                PathBuf::from(home).join(".config")
            } else {
                return Ok(LoadedConfig {
                    default_agents: None,
                    agent_configs: HashMap::new(),
                    cli_agents: options.cli_agents,
                    mcp: None,
                    gitignore: None,
                });
            };
            
            let global_config_file = global_config_dir.join("ruler").join("ruler.toml");
            if global_config_file.exists() {
                global_config_file
            } else {
                // No config file found, return default config
                return Ok(LoadedConfig {
                    default_agents: None,
                    agent_configs: HashMap::new(),
                    cli_agents: options.cli_agents,
                    mcp: None,
                    gitignore: None,
                });
            }
        }
    };

    // Read and parse the TOML file
    let config_content = fs::read_to_string(&config_file)
        .map_err(|e| create_ruler_error(
            "Failed to read configuration file",
            &format!("File: {}, Error: {}", config_file.display(), e)
        ))?;

    let config: RulerConfig = toml::from_str(&config_content)
        .map_err(|e| create_ruler_error(
            "Failed to parse configuration file",
            &format!("File: {}, Error: {}", config_file.display(), e)
        ))?;

    // Convert to LoadedConfig
    let agent_configs = config.agents.unwrap_or_default();

    Ok(LoadedConfig {
        default_agents: config.default_agents,
        agent_configs,
        cli_agents: options.cli_agents,
        mcp: config.mcp,
        gitignore: config.gitignore,
    })
}
