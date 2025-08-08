use clap::{Arg, ArgAction, ArgMatches, Command};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
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
                    Arg::new("config")
                        .long("config")
                        .num_args(1)
                        .value_name("FILE"),
                )
                .arg(
                    Arg::new("with-mcp")
                        .long("with-mcp")
                        .alias("mcp")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("no-mcp")
                        .long("no-mcp")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("mcp-overwrite")
                        .long("mcp-overwrite")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("gitignore")
                        .long("gitignore")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("no-gitignore")
                        .long("no-gitignore")
                        .action(ArgAction::SetTrue),
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
                )
                .arg(
                    Arg::new("local-only")
                        .long("local-only")
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
                    Arg::new("keep-backups")
                        .long("keep-backups")
                        .action(ArgAction::SetTrue),
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
                )
                .arg(
                    Arg::new("local-only")
                        .long("local-only")
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

fn global_ruler_dir() -> PathBuf {
    if let Ok(xdg) = env::var("XDG_CONFIG_HOME") {
        PathBuf::from(xdg).join("ruler")
    } else {
        directories::BaseDirs::new()
            .map(|b| b.home_dir().join(".config").join("ruler"))
            .unwrap_or_else(|| PathBuf::from(".config").join("ruler"))
    }
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

fn read_json_file(path: &Path) -> JsonValue {
    if let Ok(s) = fs::read_to_string(path) {
        serde_json::from_str::<JsonValue>(&s).unwrap_or(JsonValue::Object(Default::default()))
    } else {
        JsonValue::Object(Default::default())
    }
}

fn write_json_pretty(path: &Path, v: &JsonValue) -> Result<(), String> {
    ensure_parent(path)?;
    let s = serde_json::to_string_pretty(v).map_err(|e| e.to_string())? + "\n";
    fs::write(path, s).map_err(|e| e.to_string())
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum McpStrategy { Merge, Overwrite }

fn merge_mcp(base: &JsonValue, incoming: &JsonValue, server_key: &str, strategy: McpStrategy) -> JsonValue {
    // Normalize server maps
    let mut base_obj = base.as_object().cloned().unwrap_or_default();
    let base_servers = base_obj
        .get(server_key)
        .or_else(|| base_obj.get("mcpServers"))
        .or_else(|| base_obj.get("mcp"))
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();
    let incoming_servers = incoming
        .get(server_key)
        .or_else(|| incoming.get("mcpServers"))
        .or_else(|| incoming.get("mcp"))
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();

    let servers = if strategy == McpStrategy::Overwrite {
        incoming_servers
    } else {
        let mut merged = base_servers;
        for (k, v) in incoming_servers.into_iter() { merged.insert(k, v); }
        merged
    };

    base_obj.remove("mcpServers"); // cleanup old key if present
    let mut out = base_obj;
    out.insert(server_key.to_string(), JsonValue::Object(servers));
    JsonValue::Object(out)
}

fn get_native_mcp_path(adapter_name: &str, project_root: &Path) -> Option<PathBuf> {
    let home = directories::BaseDirs::new().map(|b| b.home_dir().to_path_buf());
    let mut candidates: Vec<PathBuf> = vec![];
    match adapter_name {
        "GitHub Copilot" => {
            candidates.push(project_root.join(".vscode").join("mcp.json"));
        }
        "Cursor" => {
            candidates.push(project_root.join(".cursor").join("mcp.json"));
            if let Some(h) = &home { candidates.push(h.join(".cursor").join("mcp.json")); }
        }
        "Windsurf" => {
            if let Some(h) = &home { candidates.push(h.join(".codeium").join("windsurf").join("mcp_config.json")); }
        }
        "Claude Code" => {
            candidates.push(project_root.join(".mcp.json"));
        }
        "OpenAI Codex CLI" => {
            if let Some(h) = &home { candidates.push(h.join(".codex").join("config.json")); }
        }
        "Aider" => {
            candidates.push(project_root.join(".mcp.json"));
        }
        "Open Hands" => {
            candidates.push(project_root.join(".openhands").join("config.toml"));
        }
        "Gemini CLI" => {
            candidates.push(project_root.join(".gemini").join("settings.json"));
        }
        "AugmentCode" => {
            candidates.push(project_root.join(".vscode").join("settings.json"));
        }
        "Kilo Code" => {
            candidates.push(project_root.join(".kilocode").join("mcp.json"));
        }
        "OpenCode" => {
            candidates.push(project_root.join("opencode.json"));
            if let Some(h) = &home { candidates.push(h.join(".config").join("opencode").join("opencode.json")); }
        }
        _ => {}
    }
    for p in &candidates {
        if p.exists() { return Some(p.clone()); }
    }
    candidates.into_iter().next()
}

#[derive(Debug, Deserialize, Default, Clone)]
struct TomlAgentMcpCfg {
    enabled: Option<bool>,
    merge_strategy: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct TomlAgentCfg {
    enabled: Option<bool>,
    output_path: Option<String>,
    output_path_instructions: Option<String>,
    output_path_config: Option<String>,
    mcp: Option<TomlAgentMcpCfg>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct TomlGitignoreCfg { enabled: Option<bool> }

#[derive(Debug, Deserialize, Default, Clone)]
struct TomlMcpCfg { enabled: Option<bool>, merge_strategy: Option<String> }

#[derive(Debug, Deserialize, Default, Clone)]
struct RulerTomlConfig {
    default_agents: Option<Vec<String>>,
    agents: Option<HashMap<String, TomlAgentCfg>>,
    mcp: Option<TomlMcpCfg>,
    gitignore: Option<TomlGitignoreCfg>,
}

#[derive(Debug, Default, Clone)]
struct LoadedConfig {
    default_agents: Vec<String>,
    agents: HashMap<String, TomlAgentCfg>,
    mcp_enabled: Option<bool>,
    mcp_strategy: Option<McpStrategy>,
    gitignore_enabled: Option<bool>,
}

fn load_ruler_config(project_root: &Path, config_path: Option<String>, local_only: bool, verbose: bool) -> LoadedConfig {
    // Resolve config path
    let path = if let Some(p) = config_path {
        PathBuf::from(p)
    } else {
        let local = project_root.join(".ruler").join("ruler.toml");
        if local.exists() { local } else if !local_only {
            let xdg = env::var("XDG_CONFIG_HOME").ok().map(PathBuf::from).unwrap_or_else(|| directories::BaseDirs::new().map(|b| b.home_dir().join(".config")).unwrap_or_else(|| PathBuf::from(".config")));
            xdg.join("ruler").join("ruler.toml")
        } else { local }
    };
    if verbose { eprintln!("[ruler:verbose] Loading TOML config: {}", path.display()); }
    let mut loaded = LoadedConfig::default();
    if let Ok(s) = fs::read_to_string(&path) {
        if let Ok(parsed) = toml::from_str::<RulerTomlConfig>(&s) {
            if let Some(defs) = parsed.default_agents { loaded.default_agents = defs.into_iter().map(|s| s.to_lowercase()).collect(); }
            if let Some(agents) = parsed.agents { loaded.agents = agents; }
            if let Some(m) = parsed.mcp {
                loaded.mcp_enabled = m.enabled;
                loaded.mcp_strategy = m.merge_strategy.as_deref().map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge });
            }
            if let Some(g) = parsed.gitignore { loaded.gitignore_enabled = g.enabled; }
        }
    }
    loaded
}

fn transform_ruler_to_augment_servers(ruler: &JsonValue) -> Vec<JsonValue> {
    let mut servers: Vec<JsonValue> = vec![];
    if let Some(map) = ruler.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, cfg) in map.iter() {
            let mut obj = serde_json::Map::new();
            obj.insert("name".into(), JsonValue::String(name.clone()));
            if let Some(c) = cfg.get("command").cloned() { obj.insert("command".into(), c); }
            if let Some(a) = cfg.get("args").cloned() { obj.insert("args".into(), a); }
            if let Some(e) = cfg.get("env").cloned() { obj.insert("env".into(), e); }
            servers.push(JsonValue::Object(obj));
        }
    }
    servers
}

fn update_vscode_settings_for_augment(settings_path: &Path, ruler_mcp: &JsonValue, strategy: McpStrategy) -> Result<(), String> {
    let mut settings = read_json_file(settings_path);
    let servers = transform_ruler_to_augment_servers(ruler_mcp);
    let root = settings.as_object_mut().unwrap();
    let key = "augment.advanced";
    if !root.contains_key(key) { root.insert(key.into(), JsonValue::Object(Default::default())); }
    let adv = root.get_mut(key).unwrap().as_object_mut().unwrap();
    if strategy == McpStrategy::Overwrite {
        adv.insert("mcpServers".into(), JsonValue::Array(servers));
    } else {
        let mut existing: Vec<JsonValue> = adv.get("mcpServers").and_then(|v| v.as_array().cloned()).unwrap_or_default();
        // merge by name
        for s in servers.into_iter() {
            let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(pos) = existing.iter().position(|e| e.get("name").and_then(|v| v.as_str()) == Some(name)) {
                existing[pos] = s;
            } else {
                existing.push(s);
            }
        }
        adv.insert("mcpServers".into(), JsonValue::Array(existing));
    }
    write_json_pretty(settings_path, &JsonValue::Object(root.clone()))
}

fn propagate_mcp_to_openhands(ruler_mcp: &JsonValue, dest: &Path) -> Result<(), String> {
    // Build or update TOML with mcp.stdio_servers = [ { name, command, args, env } ]
    let mut toml_val: toml::Value = if dest.exists() {
        fs::read_to_string(dest).ok().and_then(|s| toml::from_str(&s).ok()).unwrap_or(toml::Value::Table(Default::default()))
    } else {
        toml::Value::Table(Default::default())
    };
    // Navigate to mcp.stdio_servers
    let mcp_tbl = toml_val.as_table_mut().unwrap().entry("mcp").or_insert(toml::Value::Table(Default::default())).as_table_mut().unwrap();
    let arr = mcp_tbl.entry("stdio_servers").or_insert(toml::Value::Array(vec![])).as_array_mut().unwrap();
    // Build map by name
    let mut existing: std::collections::BTreeMap<String, toml::Value> = std::collections::BTreeMap::new();
    for item in arr.iter() {
        if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
            existing.insert(name.to_string(), item.clone());
        }
    }
    if let Some(servers) = ruler_mcp.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, cfg) in servers.iter() {
            let mut entry = toml::value::Table::new();
            entry.insert("name".into(), toml::Value::String(name.clone()));
            if let Some(cmd) = cfg.get("command").and_then(|v| v.as_str()) { entry.insert("command".into(), toml::Value::String(cmd.to_string())); }
            if let Some(args) = cfg.get("args").and_then(|v| v.as_array()) {
                let toml_args: Vec<toml::Value> = args.iter().filter_map(|a| a.as_str().map(|s| toml::Value::String(s.to_string()))).collect();
                entry.insert("args".into(), toml::Value::Array(toml_args));
            }
            if let Some(envm) = cfg.get("env").and_then(|v| v.as_object()) {
                let mut t = toml::value::Table::new();
                for (k, v) in envm.iter() { if let Some(s) = v.as_str() { t.insert(k.clone(), toml::Value::String(s.to_string())); } }
                entry.insert("env".into(), toml::Value::Table(t));
            }
            existing.insert(name.clone(), toml::Value::Table(entry));
        }
    }
    // Write back to array in stable order
    let mut new_arr: Vec<toml::Value> = existing.into_values().collect();
    // replace
    *arr = new_arr;
    ensure_parent(dest)?;
    let s = toml::to_string(&toml_val).map_err(|e| e.to_string())?;
    fs::write(dest, s).map_err(|e| e.to_string())
}

fn propagate_mcp_to_opencode(ruler_mcp: &JsonValue, dest: &Path) -> Result<(), String> {
    // Transform to OpenCode format
    let mut mcp_map: serde_json::Map<String, JsonValue> = serde_json::Map::new();
    if let Some(servers) = ruler_mcp.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, cfg) in servers.iter() {
            let is_remote = cfg.get("url").is_some();
            let mut entry = serde_json::Map::new();
            if is_remote {
                entry.insert("type".into(), JsonValue::String("remote".into()));
                if let Some(url) = cfg.get("url").cloned() { entry.insert("url".into(), url); }
                if let Some(h) = cfg.get("headers").cloned() { entry.insert("headers".into(), h); }
            } else {
                entry.insert("type".into(), JsonValue::String("local".into()));
                // Combine command and args
                let mut cmd: Vec<JsonValue> = vec![];
                if let Some(c) = cfg.get("command").and_then(|v| v.as_str()) { cmd.push(JsonValue::String(c.to_string())); }
                if let Some(args) = cfg.get("args").and_then(|v| v.as_array()) {
                    for a in args { if let Some(s) = a.as_str() { cmd.push(JsonValue::String(s.to_string())); } }
                }
                if !cmd.is_empty() { entry.insert("command".into(), JsonValue::Array(cmd)); }
                if let Some(env) = cfg.get("env").cloned() { entry.insert("environment".into(), env); }
            }
            entry.insert("enabled".into(), JsonValue::Bool(true));
            mcp_map.insert(name.clone(), JsonValue::Object(entry));
        }
    }
    let mut final_obj = read_json_file(dest).as_object().cloned().unwrap_or_default();
    final_obj.insert("$schema".into(), JsonValue::String("https://opencode.ai/config.json".into()));
    // merge mcp
    let existing_mcp = final_obj.get("mcp").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    let mut merged_mcp = existing_mcp;
    for (k, v) in mcp_map.into_iter() { merged_mcp.insert(k, v); }
    final_obj.insert("mcp".into(), JsonValue::Object(merged_mcp));
    write_json_pretty(dest, &JsonValue::Object(final_obj))
}

fn propagate_mcp_to_codex(ruler_mcp: &JsonValue, dest: &Path, strategy: McpStrategy) -> Result<(), String> {
    // Codex expects TOML with [mcp_servers.<name>] sections
    let mut doc: toml::Value = if dest.exists() {
        fs::read_to_string(dest).ok().and_then(|s| toml::from_str(&s).ok()).unwrap_or(toml::Value::Table(Default::default()))
    } else { toml::Value::Table(Default::default()) };
    let tbl = doc.as_table_mut().unwrap();
    // Prepare existing map of server tables
    let mut existing: std::collections::BTreeMap<String, toml::value::Table> = std::collections::BTreeMap::new();
    for (k, v) in tbl.iter() {
        if let Some(rest) = k.strip_prefix("mcp_servers.") {
            if let Some(t) = v.as_table() { existing.insert(rest.to_string(), t.clone()); }
        }
    }
    if strategy == McpStrategy::Overwrite { existing.clear(); }
    if let Some(servers) = ruler_mcp.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, cfg) in servers.iter() {
            let mut t = toml::value::Table::new();
            if let Some(cmd) = cfg.get("command").and_then(|v| v.as_str()) { t.insert("command".into(), toml::Value::String(cmd.to_string())); }
            if let Some(args) = cfg.get("args").and_then(|v| v.as_array()) {
                let arr: Vec<toml::Value> = args.iter().filter_map(|a| a.as_str().map(|s| toml::Value::String(s.to_string()))).collect();
                t.insert("args".into(), toml::Value::Array(arr));
            }
            if let Some(envm) = cfg.get("env").and_then(|v| v.as_object()) {
                let mut env_tbl = toml::value::Table::new();
                for (ek, ev) in envm.iter() { if let Some(s) = ev.as_str() { env_tbl.insert(ek.clone(), toml::Value::String(s.to_string())); } }
                t.insert("env".into(), toml::Value::Table(env_tbl));
            }
            existing.insert(name.clone(), t);
        }
    }
    // Rebuild tbl: keep non-mcp_servers keys
    let keys: Vec<String> = tbl.keys().cloned().collect();
    for k in keys { if k.starts_with("mcp_servers.") { tbl.remove(&k); } }
    for (name, t) in existing.into_iter() {
        tbl.insert(format!("mcp_servers.{}", name), toml::Value::Table(t));
    }
    ensure_parent(dest)?;
    let s = toml::to_string(&doc).map_err(|e| e.to_string())?;
    fs::write(dest, s).map_err(|e| e.to_string())
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
    let config_path = m.get_one::<String>("config").cloned();
    let local_only = m.get_flag("local-only");
    let with_mcp = m.get_flag("with-mcp");
    let no_mcp = m.get_flag("no-mcp");
    // Load TOML config (for defaults and overrides)
    let cfg = load_ruler_config(&project_root, config_path, local_only, verbose);
    // Determine MCP enabled and strategy with precedence: CLI > TOML > default(true/merge)
    let mcp_enabled = if no_mcp { false } else if with_mcp { true } else { cfg.mcp_enabled.unwrap_or(true) };
    let mcp_strategy = if m.get_flag("mcp-overwrite") { McpStrategy::Overwrite } else { cfg.mcp_strategy.unwrap_or(McpStrategy::Merge) };
    let no_gitignore = m.get_flag("no-gitignore");
    let yes_gitignore = m.get_flag("gitignore");
    let gitignore_enabled = if no_gitignore { false } else if yes_gitignore { true } else { cfg.gitignore_enabled.unwrap_or(true) };

    // Compute CWD once for consistent relative Source headers
    let _cwd = env::current_dir().unwrap();

    let ruler_dir = match find_ruler_dir(&project_root) {
        Some(p) => p,
        None => {
            if !local_only {
                let g = global_ruler_dir();
                if g.is_dir() { g } else { return Err(format!(".ruler directory not found (Searched from: {}), and no global config at {}", project_root.display(), g.display())); }
            } else {
                return Err(format!(".ruler directory not found (Searched from: {})", project_root.display()));
            }
        }
    };
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
    // Load Ruler MCP JSON if present
    let ruler_mcp_path = ruler_dir.join("mcp.json");
    let ruler_mcp_json = if ruler_mcp_path.exists() {
        if verbose { eprintln!("[ruler:verbose] Loaded MCP configuration from: {}", ruler_mcp_path.display()); }
        read_json_file(&ruler_mcp_path)
    } else { JsonValue::Object(Default::default()) };

    // Full supported agents
    let agents = vec![
        "copilot", "claude", "codex", "cursor", "windsurf", "cline", "aider", "firebase",
        "openhands", "gemini-cli", "jules", "junie", "augmentcode", "kilocode", "opencode", "goose", "crush", "amp"
    ];
    // Selection: CLI --agents > default_agents > all minus disabled
    let selected: Vec<&str> = if let Some(filters) = agents_filter {
        agents
            .into_iter()
            .filter(|id| filters.iter().any(|f| id == f || display_name(id).to_lowercase().contains(f)))
            .collect()
    } else {
        if !cfg.default_agents.is_empty() {
            let defaults: Vec<String> = cfg.default_agents.iter().map(|s| s.to_lowercase()).collect();
            agents
                .into_iter()
                .filter(|id| {
                    // Per-agent enabled override takes precedence
                    if let Some(ac) = cfg.agents.get(*id) {
                        if let Some(en) = ac.enabled {
                            return en;
                        }
                    }
                    // Otherwise select if identifier equals a default or display name contains a default substring
                    defaults.iter().any(|d|
                        id == d || display_name(id).to_lowercase().contains(d)
                    )
                })
                .collect()
        } else {
            // All agents except those explicitly disabled via per-agent config
            agents
                .into_iter()
                .filter(|id| cfg.agents.get(*id).and_then(|a| a.enabled).unwrap_or(true))
                .collect()
        }
    };

    let mut generated_paths: Vec<PathBuf> = vec![];
    let mut agents_md_written = false;

    for id in selected {
        if verbose { eprintln!("[ruler:verbose] Processing agent: {}", display_name(id)); }
        // Get per-agent overrides
        let ac = cfg.agents.get(id);
        // Helper to resolve a path override relative to project_root
        let resolve = |p: &str| -> PathBuf { let pb = PathBuf::from(p); if pb.is_absolute() { pb } else { project_root.join(p) } };
        match id {
            "copilot" => {
                let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".github").join("copilot-instructions.md"));
                ensure_parent(&dest)?;
                backup_if_exists(&dest)?;
                fs::write(&dest, &concatenated).map_err(|e| e.to_string())?;
                generated_paths.push(dest);
                // MCP
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
                        let existing = read_json_file(&dest_mcp);
                        // per-agent strategy override
                        let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
                        let merged = merge_mcp(&existing, &ruler_mcp_json, "servers", strat);
                        write_json_pretty(&dest_mcp, &merged)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "claude" => {
                let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join("CLAUDE.md"));
                backup_if_exists(&dest)?;
                fs::write(&dest, &concatenated).map_err(|e| e.to_string())?;
                generated_paths.push(dest);
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
                        let existing = read_json_file(&dest_mcp);
                        let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
                        let merged = merge_mcp(&existing, &ruler_mcp_json, "mcpServers", strat);
                        write_json_pretty(&dest_mcp, &merged)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "cursor" => {
                let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".cursor").join("rules").join("ruler_cursor_instructions.mdc"));
                ensure_parent(&dest)?;
                backup_if_exists(&dest)?;
                let mut content = String::new();
                content.push_str("---\n");
                content.push_str("alwaysApply: true\n");
                content.push_str("---\n");
                content.push_str(concatenated.trim_start());
                fs::write(&dest, content).map_err(|e| e.to_string())?;
                generated_paths.push(dest);
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
                        let existing = read_json_file(&dest_mcp);
                        let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
                        let merged = merge_mcp(&existing, &ruler_mcp_json, "mcpServers", strat);
                        write_json_pretty(&dest_mcp, &merged)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "aider" => {
                let md = ac.and_then(|a| a.output_path_instructions.as_deref()).map(resolve).unwrap_or_else(|| project_root.join("ruler_aider_instructions.md"));
                backup_if_exists(&md)?;
                fs::write(&md, &concatenated).map_err(|e| e.to_string())?;
                let cfg = ac.and_then(|a| a.output_path_config.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".aider.conf.yml"));
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
        if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
                        let existing = read_json_file(&dest_mcp);
            let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
            let merged = merge_mcp(&existing, &ruler_mcp_json, "mcpServers", strat);
                        write_json_pretty(&dest_mcp, &merged)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "codex" => {
                let md = project_root.join("AGENTS.md");
                if !agents_md_written { backup_if_exists(&md)?; fs::write(&md, &concatenated).map_err(|e| e.to_string())?; agents_md_written = true; }
                generated_paths.push(md);
                if mcp_enabled {
                    // Write TOML at .codex/config.toml
                    let dest = project_root.join(".codex").join("config.toml");
            let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
            propagate_mcp_to_codex(&ruler_mcp_json, &dest, strat)?;
                    generated_paths.push(dest);
                }
            }
            "windsurf" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".windsurf").join("rules").join("ruler_windsurf_instructions.md"));
                ensure_parent(&dest)?; backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
            }
            "cline" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".clinerules")); backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
            }
            "firebase" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".idx").join("airules.md")); ensure_parent(&dest)?; backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
            }
            "openhands" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".openhands").join("microagents").join("repo.md")); ensure_parent(&dest)?; backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
                        propagate_mcp_to_openhands(&ruler_mcp_json, &dest_mcp)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "gemini-cli" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join("GEMINI.md")); backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
            let existing = read_json_file(&dest_mcp);
            let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
            let merged = merge_mcp(&existing, &ruler_mcp_json, "mcpServers", strat);
                        write_json_pretty(&dest_mcp, &merged)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "jules" => {
                let md = project_root.join("AGENTS.md");
                if !agents_md_written { backup_if_exists(&md)?; fs::write(&md, &concatenated).map_err(|e| e.to_string())?; agents_md_written = true; }
                generated_paths.push(md);
            }
            "junie" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".junie").join("guidelines.md")); ensure_parent(&dest)?; backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
            }
            "augmentcode" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".augment").join("rules").join("ruler_augment_instructions.md")); ensure_parent(&dest)?; backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
                if mcp_enabled {
                    if let Some(dest_settings) = get_native_mcp_path(display_name(id), &project_root) {
            let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
            update_vscode_settings_for_augment(&dest_settings, &ruler_mcp_json, strat)?;
                        if dest_settings.starts_with(&project_root) { generated_paths.push(dest_settings); }
                    }
                }
            }
            "kilocode" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".kilocode").join("rules").join("ruler_kilocode_instructions.md")); ensure_parent(&dest)?; backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
            let existing = read_json_file(&dest_mcp);
            let strat = ac.and_then(|a| a.mcp.as_ref()).and_then(|m| m.merge_strategy.as_deref()).map(|s| if s.eq_ignore_ascii_case("overwrite") { McpStrategy::Overwrite } else { McpStrategy::Merge }).unwrap_or(mcp_strategy);
            let merged = merge_mcp(&existing, &ruler_mcp_json, "mcpServers", strat);
                        write_json_pretty(&dest_mcp, &merged)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "opencode" => {
                let md = project_root.join("AGENTS.md"); backup_if_exists(&md)?; fs::write(&md, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(md);
                if mcp_enabled {
                    if let Some(dest_mcp) = get_native_mcp_path(display_name(id), &project_root) {
                        propagate_mcp_to_opencode(&ruler_mcp_json, &dest_mcp)?;
                        if dest_mcp.starts_with(&project_root) { generated_paths.push(dest_mcp); }
                    }
                }
            }
            "goose" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join(".goosehints")); backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
            }
            "crush" => {
                let md = project_root.join("CRUSH.md"); backup_if_exists(&md)?; fs::write(&md, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(md);
                // Transform MCP to { mcp: {...} }
                if mcp_enabled {
                    let mut obj = serde_json::Map::new();
                    let servers = ruler_mcp_json.get("mcpServers").cloned().unwrap_or(JsonValue::Object(Default::default()));
                    obj.insert("mcp".into(), servers);
                    let mcp_path = project_root.join(".crush.json");
                    write_json_pretty(&mcp_path, &JsonValue::Object(obj))?;
                    generated_paths.push(mcp_path);
                }
            }
            "amp" => {
        let dest = ac.and_then(|a| a.output_path.as_deref()).map(resolve).unwrap_or_else(|| project_root.join("AGENT.md")); backup_if_exists(&dest)?; fs::write(&dest, &concatenated).map_err(|e| e.to_string())?; generated_paths.push(dest);
            }
            _ => {}
        }
    }

    if gitignore_enabled {
        update_gitignore(&project_root, &generated_paths)?;
    }
    println!("Ruler apply completed successfully.");
    Ok(())
}

fn display_name(id: &str) -> &str {
    match id {
        "copilot" => "GitHub Copilot",
        "claude" => "Claude Code",
        "codex" => "OpenAI Codex CLI",
        "cursor" => "Cursor",
        "aider" => "Aider",
        "windsurf" => "Windsurf",
        "cline" => "Cline",
        "firebase" => "Firebase Studio",
        "openhands" => "Open Hands",
        "gemini-cli" => "Gemini CLI",
        "jules" => "Jules",
        "junie" => "Junie",
        "augmentcode" => "AugmentCode",
        "kilocode" => "Kilo Code",
        "opencode" => "OpenCode",
        "goose" => "Goose",
        "crush" => "Crush",
        "amp" => "Amp",
        _ => id,
    }
}

fn cmd_revert(m: &ArgMatches) -> Result<(), String> {
    let project_root = opt_project_root(m);
    let verbose = m.get_flag("verbose");
    let keep_backups = m.get_flag("keep-backups");
    let items = vec![
        project_root.join("CLAUDE.md"),
        project_root.join(".github").join("copilot-instructions.md"),
        project_root
            .join(".cursor")
            .join("rules")
            .join("ruler_cursor_instructions.mdc"),
        project_root.join("ruler_aider_instructions.md"),
        project_root.join(".aider.conf.yml"),
        project_root.join("AGENTS.md"),
        project_root.join(".clinerules"),
        project_root.join(".windsurf").join("rules").join("ruler_windsurf_instructions.md"),
        project_root.join(".idx").join("airules.md"),
        project_root.join(".openhands").join("microagents").join("repo.md"),
        project_root.join("GEMINI.md"),
        project_root.join(".junie").join("guidelines.md"),
        project_root.join(".augment").join("rules").join("ruler_augment_instructions.md"),
        project_root.join(".kilocode").join("rules").join("ruler_kilocode_instructions.md"),
        project_root.join(".goosehints"),
        project_root.join("CRUSH.md"),
        project_root.join("AGENT.md"),
        project_root.join(".vscode").join("mcp.json"),
        project_root.join(".cursor").join("mcp.json"),
        project_root.join(".mcp.json"),
        project_root.join(".gemini").join("settings.json"),
        project_root.join(".kilocode").join("mcp.json"),
        project_root.join("opencode.json"),
        project_root.join(".crush.json"),
    ];
    for p in items {
        let bak = PathBuf::from(format!("{}.bak", p.to_string_lossy()));
        if bak.exists() {
            if !m.get_flag("dry-run") {
                fs::copy(&bak, &p).ok();
                if !keep_backups { let _ = fs::remove_file(&bak); }
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
    for d in [
        ".github", ".cursor", ".vscode", ".windsurf", ".junie", ".augment", ".kilocode", ".openhands", ".idx", ".gemini"
    ] {
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
