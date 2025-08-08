pub mod commands;

use clap::{Parser, Subcommand};
use anyhow::Result;

#[derive(Parser)]
#[command(name = "ruler")]
#[command(about = "Ruler — apply the same rules to all coding agents")]
#[command(version = "0.2.19")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Scaffold a .ruler directory with default files
    Init {
        /// Project root directory
        #[arg(long, default_value = ".")]
        project_root: String,
        /// Initialize in global config directory (XDG_CONFIG_HOME/ruler)
        #[arg(long)]
        global: bool,
    },
    /// Apply ruler configurations to supported AI agents
    Apply {
        /// Project root directory
        #[arg(long, default_value = ".")]
        project_root: String,
        /// Comma-separated list of agent identifiers: amp, copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush
        #[arg(long)]
        agents: Option<String>,
        /// Path to TOML configuration file
        #[arg(long)]
        config: Option<String>,
        /// Enable or disable applying MCP server config
        #[arg(long, default_value = "true")]
        mcp: bool,
        /// Replace (not merge) the native MCP config(s)
        #[arg(long)]
        mcp_overwrite: bool,
        /// Enable/disable automatic .gitignore updates (default: enabled)
        #[arg(long)]
        gitignore: Option<bool>,
        /// Enable verbose logging
        #[arg(short, long)]
        verbose: bool,
        /// Preview changes without writing files
        #[arg(long)]
        dry_run: bool,
        /// Only search for local .ruler directories, ignore global config
        #[arg(long)]
        local_only: bool,
    },
    /// Revert ruler configurations by restoring backups and removing generated files
    Revert {
        /// Project root directory
        #[arg(long, default_value = ".")]
        project_root: String,
        /// Comma-separated list of agent identifiers: amp, copilot, claude, codex, cursor, windsurf, cline, aider, firebase, gemini-cli, junie, kilocode, opencode, crush
        #[arg(long)]
        agents: Option<String>,
        /// Path to TOML configuration file
        #[arg(long)]
        config: Option<String>,
        /// Keep backup files (.bak) after restoration
        #[arg(long)]
        keep_backups: bool,
        /// Enable verbose logging
        #[arg(short, long)]
        verbose: bool,
        /// Preview changes without actually reverting files
        #[arg(long)]
        dry_run: bool,
        /// Only search for local .ruler directories, ignore global config
        #[arg(long)]
        local_only: bool,
    },
}

pub fn run() -> Result<()> {
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Init { project_root, global } => {
            commands::init_command(project_root, global)
        }
        Commands::Apply {
            project_root,
            agents,
            config,
            mcp,
            mcp_overwrite,
            gitignore,
            verbose,
            dry_run,
            local_only,
        } => {
            let agents_list = agents.map(|s| s.split(',').map(|a| a.trim().to_string()).collect());
            let mcp_strategy = if mcp_overwrite { Some(crate::types::McpStrategy::Overwrite) } else { None };
            
            commands::apply_command(
                project_root,
                agents_list,
                config,
                mcp,
                mcp_strategy,
                gitignore,
                verbose,
                dry_run,
                local_only,
            )
        }
        Commands::Revert {
            project_root,
            agents,
            config,
            keep_backups,
            verbose,
            dry_run,
            local_only,
        } => {
            let agents_list = agents.map(|s| s.split(',').map(|a| a.trim().to_string()).collect());
            
            commands::revert_command(
                project_root,
                agents_list,
                config,
                keep_backups,
                verbose,
                dry_run,
                local_only,
            )
        }
    }
}
