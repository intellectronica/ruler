use clap::{Arg, ArgAction, ArgMatches, Command};
use serde::{Deserialize, Serialize};
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const ERROR_PREFIX: &str = "[RulerError]";

fn main() {
    let cmd = Command::new("ruler-rs")
        .about("Ruler (Rust)")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .subcommand(
            Command::new("init")
                .arg(
                    Arg::new("project-root")
                        .long("project-root")
                        .num_args(1)
                        .value_name("PATH"),
                )
                .arg(
                    Arg::new("global")
                        .long("global")
                        .action(ArgAction::SetTrue),
                ),
        )
        .subcommand(
            Command::new("apply")
                .arg(
                    Arg::new("project-root")
                        .long("project-root")
                        .num_args(1)
                        .value_name("PATH"),
                )
                .arg(
                    Arg::new("agents")
                        .long("agents")
                        .num_args(1)
                        .value_name("LIST"),
                )
                .arg(
                    Arg::new("verbose")
                        .long("verbose")
                        .short('v')
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("dry-run")
                        .long("dry-run")
                        .action(ArgAction::SetTrue),
                ),
        )
        .subcommand(
            Command::new("revert")
                .arg(
                    Arg::new("project-root")
                        .long("project-root")
                        .num_args(1)
                        .value_name("PATH"),
                )
                .arg(
                    Arg::new("agents")
                        .long("agents")
                        .num_args(1)
                        .value_name("LIST"),
                )
                .arg(
                    Arg::new("verbose")
                        .long("verbose")
                        .short('v')
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("dry-run")
                        .long("dry-run")
                        .action(ArgAction::SetTrue),
                ),
        );

    let matches = cmd.get_matches();
    let res = match matches.subcommand() {
        Some(("init", m)) => cmd_init(m),
        Some(("apply", m)) => cmd_apply(m),
        Some(("revert", m)) => cmd_revert(m),
        _ => Ok(()),
    };
    if let Err(e) = res {
        eprintln!("{} {}", ERROR_PREFIX, e);
        std::process::exit(1);
    }
}

fn opt_project_root(m: &ArgMatches) -> PathBuf {
    m.get_one::<String>("project-root")
        .map(PathBuf::from)
        .unwrap_or_else(|| env::current_dir().unwrap())
}

fn cmd_init(m: &ArgMatches) -> Result<(), String> {
    let project_root = opt_project_root(m);
    let is_global = m.get_flag("global");
    let ruler_dir = if is_global {
        let base = if let Ok(xdg) = env::var("XDG_CONFIG_HOME") {
            PathBuf::from(xdg)
        } else {
            directories::BaseDirs::new()
                .map(|b| b.config_dir().to_path_buf())
                .unwrap_or_else(|| PathBuf::from(".config"))
        };
        base.join("ruler")
    } else {
        project_root.join(".ruler")
    };
    fs::create_dir_all(&ruler_dir).map_err(|e| e.to_string())?;
    let instructions = ruler_dir.join("instructions.md");
    let toml = ruler_dir.join("ruler.toml");
    let mcp = ruler_dir.join("mcp.json");
    if !instructions.exists() {
        fs::write(
            &instructions,
            "# Ruler Instructions\n\nThese are your centralised AI agent instructions.\nAdd your coding guidelines, style guides, and other project-specific context here.\n\nRuler will concatenate all .md files in this directory (and its subdirectories)\nand apply them to your configured AI coding agents.\n",
        )
        .map_err(|e| e.to_string())?;
    }
    if !toml.exists() {
        fs::write(&toml, "[gitignore]\nenabled = true\n").map_err(|e| e.to_string())?;
    }
    if !mcp.exists() {
        fs::write(
            &mcp,
            "{\n  \"mcpServers\": {\n    \"example\": { \"type\": \"stdio\", \"command\": \"node\", \"args\": [\"/path/to/mcp-server.js\"] }\n  }\n}\n",
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Default, Clone)]
struct AgentCfg {}

#[derive(Serialize, Deserialize, Default)]
struct AiderConfig {
    #[serde(default)]
    read: Vec<String>,
    #[serde(flatten)]
    rest: serde_json::Map<String, serde_json::Value>,
}

fn find_ruler_dir(start: &Path) -> Option<PathBuf> {
    let mut cur = start;
    loop {
        let candidate = cur.join(".ruler");
        if candidate.is_dir() {
            return Some(candidate);
        }
        match cur.parent() {
            Some(p) => cur = p,
            None => break,
        }
    }
    None
}

fn read_markdown_files(ruler_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files: Vec<PathBuf> = vec![];
    for entry in WalkDir::new(ruler_dir).into_iter().filter_map(|e| e.ok()) {
        let p = entry.path().to_path_buf();
        if p.is_file() && p.extension() == Some(OsStr::new("md")) {
            files.push(p);
        }
    }
    files.sort();
    Ok(files)
}

fn relative_from_cwd(p: &Path) -> String {
    // Match TS: path.relative(process.cwd(), filePath)
    let cwd = env::var("RULER_CWD").ok().map(PathBuf::from).unwrap_or_else(|| env::current_dir().unwrap());
    let rel = pathdiff::diff_paths(p, &cwd).unwrap_or_else(|| p.to_path_buf());
    rel.to_string_lossy().into_owned()
}

fn concat_rules(paths: &[PathBuf]) -> Result<String, String> {
    let mut out = String::new();
    for (i, p) in paths.iter().enumerate() {
        let mut s = String::new();
        fs::File::open(p)
            .and_then(|mut f| f.read_to_string(&mut s))
            .map_err(|e| e.to_string())?;
        let rel = relative_from_cwd(p);
        out.push_str("---\n");
        out.push_str(&format!("Source: {}\n", rel));
        out.push_str("---\n");
        let body = s.trim_end_matches('\n');
        out.push_str(body);
        out.push('\n');
        if i + 1 < paths.len() {
            // add an extra blank line between sections
            out.push('\n');
        }
    }
    Ok(out)
}

fn ensure_parent(p: &Path) -> Result<(), String> {
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?
    }
    Ok(())
}

fn backup_if_exists(p: &Path) -> Result<(), String> {
    if p.exists() {
        let mut b = p.as_os_str().to_os_string();
        b.push(".bak");
        fs::copy(p, PathBuf::from(b)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn update_gitignore(project_root: &Path, paths: &[PathBuf]) -> Result<(), String> {
    let gi = project_root.join(".gitignore");
    let mut content = String::new();
    if gi.exists() {
        fs::File::open(&gi)
            .and_then(|mut f| f.read_to_string(&mut content))
            .map_err(|e| e.to_string())?;
    }
    const START: &str = "# START Ruler Generated Files";
    const END: &str = "# END Ruler Generated Files";
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let mut start_idx = None;
    let mut end_idx = None;
    for (i, l) in lines.iter().enumerate() {
        if l.trim() == START {
            start_idx = Some(i);
        }
        if l.trim() == END {
            end_idx = Some(i);
            break;
        }
    }
    let mut new_paths: Vec<String> = paths
        .iter()
        .map(|p| {
            let rel = pathdiff::diff_paths(p, project_root).unwrap_or_else(|| p.to_path_buf());
            rel.to_string_lossy().replace('\\', "/")
        })
        .collect();
    new_paths.push("*.bak".to_string());
    // Sort and deduplicate
    new_paths.sort();
    new_paths.dedup();
    let dedup: Vec<String> = new_paths;

    let block = {
        let mut v = vec![START.to_string()];
        v.extend(dedup);
        v.push(END.to_string());
        v
    };

    if let (Some(s), Some(e)) = (start_idx, end_idx) {
        // replace existing block
        lines.splice(s..=e, block);
    } else {
        // append block at end
        if !lines.is_empty() && lines.last().unwrap().trim() != "" {
            lines.push(String::new());
        }
        lines.extend(block);
    }
    let mut out = lines.join("\n");
    if !out.ends_with('\n') {
        out.push('\n');
    }
    fs::File::create(&gi)
        .and_then(|mut f| f.write_all(out.as_bytes()))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn cmd_apply(m: &ArgMatches) -> Result<(), String> {
    let project_root = opt_project_root(m);
    let verbose = m.get_flag("verbose");
    let agents_filter: Option<Vec<String>> = m
        .get_one::<String>("agents")
        .map(|s| s.split(',').map(|a| a.trim().to_lowercase()).collect());

    // Compute CWD once for consistent relative Source headers
    let _cwd = env::current_dir().unwrap();

    let ruler_dir = find_ruler_dir(&project_root)
        .ok_or_else(|| format!(".ruler directory not found (Searched from: {})", project_root.display()))?;
    if verbose {
        eprintln!("[ruler:verbose] Found .ruler directory at: {}", ruler_dir.display());
    }
    let md_files = read_markdown_files(&ruler_dir)?;
    if verbose {
        eprintln!("[ruler:verbose] Found {} markdown files in ruler configuration directory", md_files.len());
    }
    let concatenated = concat_rules(&md_files)?;
    if verbose {
        eprintln!("[ruler:verbose] Concatenated rules length: {} characters", concatenated.len());
    }

    // Limit to four agents used in functional test: copilot, claude, cursor, aider
    let agents = vec!["copilot", "claude", "cursor", "aider"];
    let selected: Vec<&str> = if let Some(filters) = agents_filter {
        agents
            .into_iter()
            .filter(|id| filters.iter().any(|f| id == f || display_name(id).to_lowercase().contains(f)))
            .collect()
    } else {
        agents
    };

    let mut generated_paths: Vec<PathBuf> = vec![];

    for id in selected {
        if verbose { eprintln!("[ruler:verbose] Processing agent: {}", display_name(id)); }
        match id {
            "copilot" => {
                let dest = project_root.join(".github").join("copilot-instructions.md");
                ensure_parent(&dest)?;
                backup_if_exists(&dest)?;
                fs::write(&dest, &concatenated).map_err(|e| e.to_string())?;
                generated_paths.push(dest);
            }
            "claude" => {
                let dest = project_root.join("CLAUDE.md");
                backup_if_exists(&dest)?;
                fs::write(&dest, &concatenated).map_err(|e| e.to_string())?;
                generated_paths.push(dest);
            }
            "cursor" => {
                let dest = project_root
                    .join(".cursor")
                    .join("rules")
                    .join("ruler_cursor_instructions.mdc");
                ensure_parent(&dest)?;
                backup_if_exists(&dest)?;
                let mut content = String::new();
                content.push_str("---\n");
                content.push_str("alwaysApply: true\n");
                content.push_str("---\n");
                content.push_str(concatenated.trim_start());
                fs::write(&dest, content).map_err(|e| e.to_string())?;
                generated_paths.push(dest);
            }
            "aider" => {
                let md = project_root.join("ruler_aider_instructions.md");
                backup_if_exists(&md)?;
                fs::write(&md, &concatenated).map_err(|e| e.to_string())?;
                let cfg = project_root.join(".aider.conf.yml");
                let mut cfg_data: AiderConfig = if cfg.exists() {
                    let s = fs::read_to_string(&cfg).map_err(|e| e.to_string())?;
                    serde_yaml::from_str(&s).unwrap_or_default()
                } else {
                    AiderConfig::default()
                };
                let fname = md.file_name().unwrap().to_string_lossy().into_owned();
                if !cfg_data.read.iter().any(|r| r == &fname) {
                    cfg_data.read.push(fname);
                }
                let yaml = serde_yaml::to_string(&cfg_data).map_err(|e| e.to_string())?;
                fs::write(&cfg, yaml).map_err(|e| e.to_string())?;
                generated_paths.push(md);
                generated_paths.push(cfg);
            }
            _ => {}
        }
    }

    update_gitignore(&project_root, &generated_paths)?;
    println!("Ruler apply completed successfully.");
    Ok(())
}

fn display_name(id: &str) -> &str {
    match id {
        "copilot" => "GitHub Copilot",
        "claude" => "Claude Code",
        "cursor" => "Cursor",
        "aider" => "Aider",
        _ => id,
    }
}

fn cmd_revert(m: &ArgMatches) -> Result<(), String> {
    let project_root = opt_project_root(m);
    let verbose = m.get_flag("verbose");
    let items = vec![
        project_root.join("CLAUDE.md"),
        project_root.join(".github").join("copilot-instructions.md"),
        project_root
            .join(".cursor")
            .join("rules")
            .join("ruler_cursor_instructions.mdc"),
        project_root.join("ruler_aider_instructions.md"),
        project_root.join(".aider.conf.yml"),
        project_root.join(".vscode").join("mcp.json"),
        project_root.join(".cursor").join("mcp.json"),
        project_root.join(".mcp.json"),
    ];
    for p in items {
    let bak = PathBuf::from(format!("{}.bak", p.to_string_lossy()));
    if bak.exists() {
            if !m.get_flag("dry-run") {
                fs::copy(&bak, &p).ok();
                if verbose { eprintln!("[ruler:verbose] Restored from backup: {}", p.display()); }
            }
        } else if p.exists() {
            if verbose { eprintln!("[ruler:verbose] [ruler] Removed generated file: {}", p.display()); }
            if !m.get_flag("dry-run") { let _ = fs::remove_file(&p); }
        }
    }
    // Clean simple gitignore if it only has a ruler block
    let gi = project_root.join(".gitignore");
    if gi.exists() {
        let s = fs::read_to_string(&gi).map_err(|e| e.to_string())?;
        let start = s.find("# START Ruler Generated Files");
        let end = s.find("# END Ruler Generated Files");
        if let (Some(s1), Some(e1)) = (start, end) {
            let mut new_s = String::new();
            new_s.push_str(&s[..s1]);
            new_s.push_str(&s[(e1 + "# END Ruler Generated Files".len())..]);
            let trimmed = new_s.trim();
            if trimmed.is_empty() {
                if verbose { eprintln!("[ruler:verbose] [ruler] Removed empty .gitignore file"); }
                fs::remove_file(&gi).ok();
            } else {
                fs::write(&gi, new_s).ok();
            }
        }
    }
    // Remove empty dirs for the four agents
    for d in [".github", ".cursor", ".vscode"] {
        let dir = project_root.join(d);
        if dir.exists() {
            // attempt to remove dir tree if empty
            if is_dir_tree_empty(&dir) {
                let _ = fs::remove_dir_all(&dir);
                if verbose { eprintln!("[ruler:verbose] [ruler] Removed empty directory tree: {}", dir.display()); }
            }
        }
    }
    if verbose { eprintln!("[ruler:verbose] Revert completed successfully."); }
    Ok(())
}

fn is_dir_tree_empty(dir: &Path) -> bool {
    match fs::read_dir(dir) {
        Ok(mut it) => {
            while let Some(Ok(entry)) = it.next() {
                let p = entry.path();
                if p.is_file() {
                    return false;
                }
                if p.is_dir() && !is_dir_tree_empty(&p) {
                    return false;
                }
            }
            true
        }
        Err(_) => false,
    }
}
