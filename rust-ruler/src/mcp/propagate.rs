use crate::types::McpStrategy;
use crate::mcp::merge::{merge_mcp_config, McpMergeOptions, mcp_to_toml_format};
use crate::core::filesystem::{backup_file, write_generated_file};
use anyhow::{Result, Context};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::fs;

/// Get the native MCP configuration path for an agent
pub fn get_native_mcp_path(agent_name: &str, project_root: &Path) -> Result<PathBuf> {
    let path = match agent_name.to_lowercase().as_str() {
        "github copilot" | "copilot" => project_root.join(".github").join("copilot").join("mcp.json"),
        "claude code" | "claude" => {
            // Claude stores MCP config in VS Code settings
            project_root.join(".vscode").join("settings.json")
        },
        "openai codex cli" | "codex" => project_root.join(".codex").join("config.toml"),
        "cursor" => project_root.join(".cursor").join("mcp.json"),
        "windsurf" => project_root.join(".windsurf").join("mcp.json"),
        "cline" => project_root.join(".cline").join("mcp.json"),
        "aider" => project_root.join(".aider").join("mcp.json"),
        "firebase studio" | "firebase" => project_root.join(".firebase").join("mcp.json"),
        "open hands" | "openhands" => project_root.join(".openhands").join("config.toml"),
        "gemini cli" | "gemini" => project_root.join(".gemini").join("mcp.json"),
        "jules" => project_root.join("AGENTS.md"), // Jules and Junie share the same file
        "junie" => project_root.join("AGENTS.md"),
        "augmentcode" | "augment" => {
            // AugmentCode uses VS Code settings
            project_root.join(".vscode").join("settings.json")
        },
        "kilo code" | "kilocode" => project_root.join(".kilocode").join("mcp.json"),
        "opencode" => project_root.join("opencode.json"),
        "goose" => project_root.join(".goose").join("mcp.json"),
        "crush" => project_root.join(".crush").join("mcp.json"),
        "amp" => project_root.join(".amp").join("mcp.json"),
        _ => return Err(anyhow::anyhow!("Unknown agent: {}", agent_name)),
    };
    
    Ok(path)
}

/// Propagate MCP configuration to an agent's native format
pub fn propagate_mcp_to_agent(
    agent_name: &str,
    ruler_mcp_json: &Value,
    project_root: &Path,
    strategy: McpStrategy,
) -> Result<()> {
    let native_path = get_native_mcp_path(agent_name, project_root)?;
    
    match agent_name.to_lowercase().as_str() {
        "openai codex cli" | "codex" => {
            propagate_to_codex_cli(ruler_mcp_json, &native_path, strategy)
        },
        "claude code" | "claude" | "augmentcode" | "augment" => {
            propagate_to_vscode_settings(ruler_mcp_json, &native_path, strategy, agent_name)
        },
        "open hands" | "openhands" => {
            propagate_to_openhands_toml(ruler_mcp_json, &native_path, strategy)
        },
        "opencode" => {
            propagate_to_opencode_json(ruler_mcp_json, &native_path, strategy)
        },
        _ => {
            // Standard JSON format for most agents
            propagate_to_json_format(ruler_mcp_json, &native_path, strategy, "mcpServers")
        }
    }
}

/// Propagate MCP config to Codex CLI's TOML format
fn propagate_to_codex_cli(
    ruler_mcp_json: &Value,
    config_path: &Path,
    strategy: McpStrategy,
) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
    }

    let existing_content = fs::read_to_string(config_path).unwrap_or_default();
    
    // Parse existing TOML if it exists
    let mut existing_config: toml::Value = if existing_content.trim().is_empty() {
        toml::Value::Table(toml::map::Map::new())
    } else {
        toml::from_str(&existing_content)
            .with_context(|| format!("Failed to parse existing TOML config: {}", config_path.display()))?
    };

    // Extract MCP servers from ruler config
    // Get mcpServers from the ruler config
    let default_servers = Value::Object(serde_json::Map::new());
    let ruler_servers = ruler_mcp_json.get("mcpServers")
        .unwrap_or(&default_servers);

    // Handle strategy
    if strategy == McpStrategy::Overwrite {
        // Remove existing mcp_servers section
        if let toml::Value::Table(ref mut table) = existing_config {
            table.remove("mcp_servers");
        }
    }

    // Convert ruler MCP servers to TOML format and append
    let mcp_toml = mcp_to_toml_format(ruler_servers)?;
    
    if !mcp_toml.trim().is_empty() {
        let final_content = if existing_content.trim().is_empty() {
            mcp_toml
        } else {
            // Remove any existing mcp_servers section and append new one
            let lines: Vec<&str> = existing_content.lines().collect();
            let mut filtered_lines = Vec::new();
            let mut in_mcp_section = false;
            
            for line in lines {
                if line.trim().starts_with("[mcp_servers.") {
                    in_mcp_section = true;
                    continue;
                }
                if in_mcp_section && (line.trim().is_empty() || line.starts_with('[')) {
                    in_mcp_section = false;
                    if line.starts_with('[') && !line.trim().starts_with("[mcp_servers.") {
                        filtered_lines.push(line);
                    }
                    continue;
                }
                if !in_mcp_section {
                    filtered_lines.push(line);
                }
            }
            
            format!("{}\n\n{}", filtered_lines.join("\n").trim(), mcp_toml)
        };

        backup_file(config_path)?;
        write_generated_file(config_path, &final_content)?;
    }

    Ok(())
}

/// Propagate MCP config to VS Code settings.json (for Claude and AugmentCode)
fn propagate_to_vscode_settings(
    ruler_mcp_json: &Value,
    settings_path: &Path,
    strategy: McpStrategy,
    agent_name: &str,
) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
    }

    let existing_content = fs::read_to_string(settings_path).unwrap_or_else(|_| "{}".to_string());
    let mut settings: Value = serde_json::from_str(&existing_content)
        .with_context(|| format!("Failed to parse VS Code settings: {}", settings_path.display()))?;

    // Transform ruler MCP to VS Code format
    if let Some(mcp_servers) = ruler_mcp_json.get("mcpServers").and_then(|v| v.as_object()) {
        let settings_obj = settings.as_object_mut()
            .ok_or_else(|| anyhow::anyhow!("VS Code settings is not an object"))?;

        match agent_name.to_lowercase().as_str() {
            "claude code" | "claude" => {
                // Claude uses "claude.mcpServers" key
                if strategy == McpStrategy::Overwrite {
                    settings_obj.remove("claude.mcpServers");
                }
                
                let mut claude_servers = settings_obj.get("claude.mcpServers")
                    .and_then(|v| v.as_object())
                    .cloned()
                    .unwrap_or_default();

                for (name, config) in mcp_servers {
                    claude_servers.insert(name.clone(), config.clone());
                }

                settings_obj.insert("claude.mcpServers".to_string(), Value::Object(claude_servers));
            },
            "augmentcode" | "augment" => {
                // AugmentCode uses "augment.advanced.mcpServers" array format
                let servers_array = transform_to_augment_format(mcp_servers);
                
                if !settings_obj.contains_key("augment.advanced") {
                    settings_obj.insert("augment.advanced".to_string(), Value::Object(serde_json::Map::new()));
                }
                
                let augment_obj = settings_obj.get_mut("augment.advanced")
                    .and_then(|v| v.as_object_mut())
                    .ok_or_else(|| anyhow::anyhow!("augment.advanced is not an object"))?;

                if strategy == McpStrategy::Overwrite {
                    augment_obj.insert("mcpServers".to_string(), Value::Array(servers_array));
                } else {
                    // Merge with existing servers
                    let mut existing_servers = augment_obj.get("mcpServers")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();
                    
                    existing_servers.extend(servers_array);
                    augment_obj.insert("mcpServers".to_string(), Value::Array(existing_servers));
                }
            },
            _ => return Err(anyhow::anyhow!("Unsupported agent for VS Code settings: {}", agent_name)),
        }
    }

    let formatted_content = serde_json::to_string_pretty(&settings)
        .with_context(|| "Failed to serialize VS Code settings")?;

    backup_file(settings_path)?;
    write_generated_file(settings_path, &formatted_content)?;

    Ok(())
}

/// Transform ruler MCP servers to AugmentCode format
fn transform_to_augment_format(mcp_servers: &serde_json::Map<String, Value>) -> Vec<Value> {
    let mut servers = Vec::new();
    
    for (name, config) in mcp_servers {
        if let Value::Object(server_config) = config {
            let mut augment_server = serde_json::Map::new();
            augment_server.insert("name".to_string(), Value::String(name.clone()));
            
            if let Some(command) = server_config.get("command") {
                augment_server.insert("command".to_string(), command.clone());
            }
            
            if let Some(args) = server_config.get("args") {
                augment_server.insert("args".to_string(), args.clone());
            }
            
            if let Some(env) = server_config.get("env") {
                augment_server.insert("env".to_string(), env.clone());
            }
            
            servers.push(Value::Object(augment_server));
        }
    }
    
    servers
}

/// Propagate MCP config to OpenHands TOML format
fn propagate_to_openhands_toml(
    ruler_mcp_json: &Value,
    config_path: &Path,
    strategy: McpStrategy,
) -> Result<()> {
    // TODO: Implement OpenHands TOML format propagation
    // This is more complex as it uses a different TOML structure
    
    // For now, use the standard JSON format
    propagate_to_json_format(ruler_mcp_json, config_path, strategy, "mcpServers")
}

/// Propagate MCP config to OpenCode JSON format
fn propagate_to_opencode_json(
    ruler_mcp_json: &Value,
    config_path: &Path,
    strategy: McpStrategy,
) -> Result<()> {
    // TODO: Implement OpenCode specific format transformation
    // OpenCode has a specific schema with local/remote server types
    
    // For now, use the standard JSON format
    propagate_to_json_format(ruler_mcp_json, config_path, strategy, "mcp")
}

/// Propagate MCP config to standard JSON format
fn propagate_to_json_format(
    ruler_mcp_json: &Value,
    config_path: &Path,
    strategy: McpStrategy,
    server_key: &str,
) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
    }

    let existing_content = fs::read_to_string(config_path).unwrap_or_else(|_| "{}".to_string());
    let existing_config: Value = serde_json::from_str(&existing_content)
        .with_context(|| format!("Failed to parse existing config: {}", config_path.display()))?;

    let options = McpMergeOptions {
        strategy,
        server_key: server_key.to_string(),
    };

    let merged_config = merge_mcp_config(&existing_config, ruler_mcp_json, &options)?;
    
    let formatted_content = serde_json::to_string_pretty(&merged_config)
        .with_context(|| "Failed to serialize merged config")?;

    backup_file(config_path)?;
    write_generated_file(config_path, &formatted_content)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use serde_json::json;

    #[test]
    fn test_get_native_mcp_path() {
        let temp_dir = TempDir::new().unwrap();
        let project_root = temp_dir.path();

        let codex_path = get_native_mcp_path("codex", project_root).unwrap();
        assert_eq!(codex_path, project_root.join(".codex").join("config.toml"));

        let cursor_path = get_native_mcp_path("cursor", project_root).unwrap();
        assert_eq!(cursor_path, project_root.join(".cursor").join("mcp.json"));
    }

    #[test]
    fn test_transform_to_augment_format() {
        let mut servers = serde_json::Map::new();
        servers.insert("filesystem".to_string(), json!({
            "command": "npx",
            "args": ["@mcp/filesystem"],
            "env": {
                "DEBUG": "true"
            }
        }));

        let result = transform_to_augment_format(&servers);
        assert_eq!(result.len(), 1);
        
        let server = &result[0];
        assert_eq!(server["name"], "filesystem");
        assert_eq!(server["command"], "npx");
        assert_eq!(server["args"], json!(["@mcp/filesystem"]));
    }
}
