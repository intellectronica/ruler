use anyhow::Result;
use std::path::{Path, PathBuf};
use std::fs;
use walkdir::WalkDir;
use directories::ProjectDirs;

/// Gets the XDG config directory path, falling back to ~/.config if XDG_CONFIG_HOME is not set
fn get_xdg_config_dir() -> PathBuf {
    if let Ok(xdg_config) = std::env::var("XDG_CONFIG_HOME") {
        PathBuf::from(xdg_config)
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".config")
    } else {
        PathBuf::from(".config")
    }
}

/// Searches upwards from start_path to find a directory named .ruler.
/// If not found locally and check_global is true, checks for global config at XDG_CONFIG_HOME/ruler.
/// Returns the path to the .ruler directory, or None if not found.
pub fn find_ruler_dir(start_path: &Path, check_global: bool) -> Result<Option<PathBuf>> {
    // First, search upwards from start_path for local .ruler directory
    let mut current = start_path.to_path_buf();
    loop {
        let candidate = current.join(".ruler");
        if candidate.is_dir() {
            return Ok(Some(candidate));
        }
        
        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => break,
        }
    }

    // If no local .ruler found and check_global is true, check global config directory
    if check_global {
        let global_config_dir = get_xdg_config_dir().join("ruler");
        if global_config_dir.is_dir() {
            return Ok(Some(global_config_dir));
        }
    }

    Ok(None)
}

/// Recursively reads all Markdown (.md) files in ruler_dir, returning their paths and contents.
/// Files are sorted alphabetically by path.
pub fn read_markdown_files(ruler_dir: &Path) -> Result<Vec<(PathBuf, String)>> {
    let mut results = Vec::new();
    
    for entry in WalkDir::new(ruler_dir) {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
            let content = fs::read_to_string(path)?;
            results.push((path.to_path_buf(), content));
        }
    }
    
    // Sort alphabetically by path
    results.sort_by(|a, b| a.0.cmp(&b.0));
    
    Ok(results)
}

/// Writes content to file_path, creating parent directories if necessary
pub fn write_generated_file(file_path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(file_path, content)?;
    Ok(())
}

/// Creates a backup of the given file_path by copying it to file_path.bak if it exists
pub fn backup_file(file_path: &Path) -> Result<()> {
    if file_path.exists() {
        let backup_path = file_path.with_extension(
            format!("{}.bak", file_path.extension().and_then(|e| e.to_str()).unwrap_or(""))
        );
        fs::copy(file_path, backup_path)?;
    }
    Ok(())
}

/// Ensures that the given directory exists by creating it recursively
pub fn ensure_dir_exists(dir_path: &Path) -> Result<()> {
    fs::create_dir_all(dir_path)?;
    Ok(())
}
