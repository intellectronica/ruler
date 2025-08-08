use anyhow::Result;
use std::path::{Path, PathBuf};
use std::fs;
use directories::ProjectDirs;
use crate::types::McpStrategy;

pub fn init_command(project_root: String, global: bool) -> Result<()> {
    let ruler_dir = if global {
        // Match TypeScript: XDG_CONFIG_HOME/ruler or ~/.config/ruler
        let config_home = std::env::var("XDG_CONFIG_HOME")
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                format!("{}/.config", home)
            });
        PathBuf::from(config_home).join("ruler")
    } else {
        PathBuf::from(project_root).join(".ruler")
    };

    // Create the ruler directory
    fs::create_dir_all(&ruler_dir)?;

    let instructions_path = ruler_dir.join("instructions.md");
    let toml_path = ruler_dir.join("ruler.toml");
    let mcp_path = ruler_dir.join("mcp.json");

    // Check if files exist to avoid overwriting
    let file_exists = |path: &Path| path.exists();

    let default_instructions = r#"# Ruler Instructions

These are your centralised AI agent instructions.
Add your coding guidelines, style guides, and other project-specific context here.

Ruler will concatenate all .md files in this directory (and its subdirectories)
and apply them to your configured AI coding agents.
"#;

    let default_toml = r#"# Ruler Configuration File
# See https://ai.intellectronica.net/ruler for documentation.

# To specify which agents are active by default when --agents is not used,
# uncomment and populate the following line. If omitted, all agents are active.
# default_agents = ["copilot", "claude"]

# --- Agent Specific Configurations ---
# You can enable/disable agents and override their default output paths here.
# Use lowercase agent identifiers: amp, copilot, claude, codex, cursor, windsurf, cline, aider, kilocode

# [agents.copilot]
# enabled = true
# output_path = ".github/copilot-instructions.md"

# [agents.claude]
# enabled = true
# output_path = "CLAUDE.md"

# [agents.codex]
# enabled = true
# output_path = "AGENTS.md"

# [agents.cursor]
# enabled = true
# output_path = ".cursor/rules/ruler_cursor_instructions.mdc"

# [agents.windsurf]
# enabled = true
# output_path = ".windsurf/rules/ruler_windsurf_instructions.md"

# [agents.cline]
# enabled = true
# output_path = ".clinerules"

# [agents.aider]
# enabled = true
# output_path_instructions = "ruler_aider_instructions.md"
# output_path_config = ".aider.conf.yml"

# [agents.firebase]
# enabled = true
# output_path = ".idx/airules.md"

# [agents.gemini-cli]
# enabled = true

# [agents.kilocode]
# enabled = true
# output_path = ".kilocode/rules/ruler_kilocode_instructions.md"
"#;

    let default_mcp_json = r#"{
  "mcpServers": {
    "example": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
"#;

    // Create instructions.md if it doesn't exist
    if !file_exists(&instructions_path) {
        fs::write(&instructions_path, default_instructions)?;
        println!("[ruler] Created {}", instructions_path.display());
    } else {
        println!("[ruler] instructions.md already exists, skipping");
    }

    // Create ruler.toml if it doesn't exist
    if !file_exists(&toml_path) {
        fs::write(&toml_path, default_toml)?;
        println!("[ruler] Created {}", toml_path.display());
    } else {
        println!("[ruler] ruler.toml already exists, skipping");
    }

    // Create mcp.json if it doesn't exist
    if !file_exists(&mcp_path) {
        fs::write(&mcp_path, default_mcp_json)?;
        println!("[ruler] Created {}", mcp_path.display());
    } else {
        println!("[ruler] mcp.json already exists, skipping");
    }

    Ok(())
}

pub fn apply_command(
    project_root: String,
    agents: Option<Vec<String>>,
    config: Option<String>,
    mcp_enabled: bool,
    mcp_strategy: Option<McpStrategy>,
    gitignore_enabled: Option<bool>,
    verbose: bool,
    dry_run: bool,
    local_only: bool,
) -> Result<()> {
    use crate::core::{filesystem, config as config_loader, rules};
    use crate::types::{ConfigOptions, create_ruler_error};
    use crate::agents::{get_all_agents, Agent};
    use std::path::PathBuf;

    let action_prefix = if dry_run { "[ruler:dry-run]" } else { "[ruler]" };
    
    if verbose {
        println!("Loading configuration from project root: {}", project_root);
    }
    
    // Load configuration
    let config_options = ConfigOptions {
        project_root: PathBuf::from(&project_root),
        cli_agents: agents.clone(),
        config_path: config.map(PathBuf::from),
    };
    
    let loaded_config = config_loader::load_config(config_options)?;
    
    if verbose {
        println!("Loaded configuration with {} agent configs", loaded_config.agent_configs.len());
    }
    
    // Find .ruler directory
    let ruler_dir = filesystem::find_ruler_dir(&PathBuf::from(&project_root), !local_only)?
        .ok_or_else(|| create_ruler_error(
            ".ruler directory not found",
            &format!("Searched from: {}", project_root)
        ))?;
    
    if verbose {
        println!("Found .ruler directory at: {}", ruler_dir.display());
    }
    
    // Read markdown files
    let files = filesystem::read_markdown_files(&ruler_dir)?;
    if verbose {
        println!("Found {} markdown files in ruler configuration directory", files.len());
    }
    
    // Concatenate rules
    let concatenated = rules::concatenate_rules(&files);
    if verbose {
        println!("Concatenated rules length: {} characters", concatenated.len());
    }
    
    // Get all available agents
    let all_agents = get_all_agents();
    
    // Determine which agents to run
    let selected_agents: Vec<&Box<dyn Agent>> = if let Some(ref agent_names) = agents {
        // CLI specified agents
        let mut selected = Vec::new();
        for agent_name in agent_names {
            let agent_name_lower = agent_name.to_lowercase();
            let found = all_agents.iter().find(|agent| {
                agent.identifier() == agent_name_lower || 
                agent.name().to_lowercase().contains(&agent_name_lower)
            });
            
            match found {
                Some(agent) => selected.push(agent),
                None => {
                    let valid_agents: Vec<_> = all_agents.iter().map(|a| a.identifier()).collect();
                    return Err(create_ruler_error(
                        &format!("Invalid agent specified: {}", agent_name),
                        &format!("Valid agents are: {}", valid_agents.join(", "))
                    ));
                }
            }
        }
        selected
    } else if let Some(ref default_agents) = loaded_config.default_agents {
        // Config specified default agents
        let mut selected = Vec::new();
        for agent_name in default_agents {
            let agent_name_lower = agent_name.to_lowercase();
            let found = all_agents.iter().find(|agent| {
                agent.identifier() == agent_name_lower || 
                agent.name().to_lowercase().contains(&agent_name_lower)
            });
            
            if let Some(agent) = found {
                // Check if this agent is explicitly disabled in config
                let agent_config = loaded_config.agent_configs.get(agent.identifier());
                let enabled = agent_config.and_then(|c| c.enabled).unwrap_or(true);
                if enabled {
                    selected.push(agent);
                }
            }
        }
        selected
    } else {
        // All agents, but respect enabled flags
        all_agents.iter().filter(|agent| {
            let agent_config = loaded_config.agent_configs.get(agent.identifier());
            let enabled = agent_config.and_then(|c| c.enabled).unwrap_or(true);
            enabled
        }).collect()
    };
    
    if verbose {
        let agent_names: Vec<_> = selected_agents.iter().map(|a| a.name()).collect();
        println!("Selected agents: {}", agent_names.join(", "));
    }
    
    // Apply configuration for each selected agent
    for agent in &selected_agents {
        println!("{} Applying rules for {}...", action_prefix, agent.name());
        
        if verbose {
            println!("Processing agent: {}", agent.name());
        }
        
        let agent_config = loaded_config.agent_configs.get(agent.identifier());
        
        if !dry_run {
            agent.apply_config(
                &concatenated,
                &PathBuf::from(&project_root),
                None, // TODO: Add MCP support later
                agent_config,
            )?;
        } else {
            // For dry run, just show what would be done
            let output_path = match agent_config.and_then(|c| c.output_path.as_ref()) {
                Some(path) => PathBuf::from(path),
                None => match agent.default_output_path(&PathBuf::from(&project_root)) {
                    crate::types::OutputPath::Single(path) => path,
                    crate::types::OutputPath::Multiple(paths) => {
                        // For dry run, just pick the first available path
                        paths.values().next().unwrap_or(&PathBuf::from("unknown")).clone()
                    },
                },
            };
            
            if verbose {
                println!("DRY RUN: Would write rules to: {}", output_path.display());
            }
        }
    }
    
    if !dry_run {
        println!("Ruler apply completed successfully.");
    } else {
        println!("✓ Dry run completed - no files were modified");
    }
    
    Ok(())
}pub fn revert_command(
    project_root: String,
    agents: Option<Vec<String>>,
    config: Option<String>,
    keep_backups: bool,
    verbose: bool,
    dry_run: bool,
    local_only: bool,
) -> Result<()> {
    // TODO: Implement revert command  
    println!("Revert command not yet implemented");
    Ok(())
}
