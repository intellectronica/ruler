use crate::types::McpStrategy;
use anyhow::Result;
use serde_json::{Value, Map};
use std::collections::HashMap;

/// Options for MCP configuration merging
pub struct McpMergeOptions {
    pub strategy: McpStrategy,
    pub server_key: String,
}

/// Merge native and incoming MCP server configurations according to strategy
///
/// # Arguments
/// * `base` - Existing native MCP config object
/// * `incoming` - Ruler MCP config object  
/// * `options` - Merge options including strategy and server key
///
/// # Returns
/// Merged MCP config object
pub fn merge_mcp_config(
    base: &Value,
    incoming: &Value,
    options: &McpMergeOptions,
) -> Result<Value> {
    if options.strategy == McpStrategy::Overwrite {
        // For overwrite strategy, replace entirely with incoming servers
        let incoming_servers = extract_mcp_servers(incoming)?;
        
        let mut result = Map::new();
        result.insert(options.server_key.clone(), incoming_servers);
        return Ok(Value::Object(result));
    }

    // For merge strategy, combine existing and incoming servers
    let mut base_map = if let Value::Object(obj) = base {
        obj.clone()
    } else {
        Map::new()
    };

    let base_servers = base_map.get(&options.server_key)
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let incoming_servers = extract_mcp_servers(incoming)?;
    let mut merged_servers = base_servers;

    // Merge in the incoming servers (overwrites servers with same name)
    if let Value::Object(incoming_obj) = incoming_servers {
        for (key, value) in incoming_obj {
            merged_servers.insert(key, value);
        }
    }

    base_map.insert(options.server_key.clone(), Value::Object(merged_servers));
    Ok(Value::Object(base_map))
}

/// Extract MCP servers from ruler config, handling different formats
fn extract_mcp_servers(config: &Value) -> Result<Value> {
    // Try different possible keys where servers might be stored
    if let Value::Object(obj) = config {
        // Standard ruler format: { "mcpServers": { ... } }
        if let Some(servers) = obj.get("mcpServers") {
            return Ok(servers.clone());
        }
        
        // Alternative format: { "mcp": { ... } }
        if let Some(servers) = obj.get("mcp") {
            return Ok(servers.clone());
        }
        
        // Direct servers format (already unwrapped)
        return Ok(config.clone());
    }
    
    // Return empty object if no servers found
    Ok(Value::Object(Map::new()))
}

/// Convert ruler MCP config to TOML format for Codex CLI
pub fn mcp_to_toml_format(mcp_servers: &Value) -> Result<String> {
    if let Value::Object(servers) = mcp_servers {
        let mut toml_lines = Vec::new();
        
        for (server_name, server_config) in servers {
            if let Value::Object(config) = server_config {
                toml_lines.push(format!("[mcp_servers.{}]", server_name));
                
                if let Some(command) = config.get("command").and_then(|v| v.as_str()) {
                    toml_lines.push(format!("command = \"{}\"", command));
                }
                
                if let Some(args) = config.get("args").and_then(|v| v.as_array()) {
                    let args_str = args.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| format!("\"{}\"", s))
                        .collect::<Vec<_>>()
                        .join(", ");
                    toml_lines.push(format!("args = [{}]", args_str));
                }
                
                if let Some(env) = config.get("env").and_then(|v| v.as_object()) {
                    let env_pairs: Vec<String> = env.iter()
                        .map(|(k, v)| {
                            let val = v.as_str().unwrap_or("");
                            format!("{} = \"{}\"", k, val)
                        })
                        .collect();
                    if !env_pairs.is_empty() {
                        toml_lines.push(format!("env = {{ {} }}", env_pairs.join(", ")));
                    }
                }
                
                toml_lines.push(String::new()); // Empty line between servers
            }
        }
        
        Ok(toml_lines.join("\n"))
    } else {
        Ok(String::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_merge_strategy_overwrite() {
        let base = json!({
            "mcpServers": {
                "existing": {
                    "command": "old-command"
                }
            }
        });
        
        let incoming = json!({
            "mcpServers": {
                "new-server": {
                    "command": "new-command"
                }
            }
        });
        
        let options = McpMergeOptions {
            strategy: McpStrategy::Overwrite,
            server_key: "mcpServers".to_string(),
        };
        
        let result = merge_mcp_config(&base, &incoming, &options).unwrap();
        
        // Should only have the new server
        assert!(result["mcpServers"]["existing"].is_null());
        assert_eq!(result["mcpServers"]["new-server"]["command"], "new-command");
    }

    #[test]
    fn test_merge_strategy_merge() {
        let base = json!({
            "mcpServers": {
                "existing": {
                    "command": "old-command"
                }
            }
        });
        
        let incoming = json!({
            "mcpServers": {
                "new-server": {
                    "command": "new-command"
                }
            }
        });
        
        let options = McpMergeOptions {
            strategy: McpStrategy::Merge,
            server_key: "mcpServers".to_string(),
        };
        
        let result = merge_mcp_config(&base, &incoming, &options).unwrap();
        
        // Should have both servers
        assert_eq!(result["mcpServers"]["existing"]["command"], "old-command");
        assert_eq!(result["mcpServers"]["new-server"]["command"], "new-command");
    }

    #[test]
    fn test_mcp_to_toml_format() {
        let servers = json!({
            "filesystem": {
                "command": "npx",
                "args": ["@modelcontextprotocol/server-filesystem", "/path/to/project"],
                "env": {
                    "DEBUG": "true"
                }
            }
        });
        
        let toml = mcp_to_toml_format(&servers).unwrap();
        
        assert!(toml.contains("[mcp_servers.filesystem]"));
        assert!(toml.contains("command = \"npx\""));
        assert!(toml.contains("args = [\"@modelcontextprotocol/server-filesystem\", \"/path/to/project\"]"));
        assert!(toml.contains("env = { DEBUG = \"true\" }"));
    }
}
