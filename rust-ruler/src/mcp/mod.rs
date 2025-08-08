//! MCP (Model Context Protocol) server configuration and merging functionality
//! 
//! This module handles the propagation of MCP server configurations from ruler's
//! central mcp.json to agent-specific configuration files.

pub mod merge;
pub mod propagate;

pub use merge::{merge_mcp_config, McpMergeOptions};
pub use propagate::{propagate_mcp_to_agent, get_native_mcp_path};
