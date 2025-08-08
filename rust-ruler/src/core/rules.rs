use std::path::Path;

/// Concatenates markdown rule files into a single string,
/// marking each section with its source filename.
pub fn concatenate_rules(files: &[(std::path::PathBuf, String)]) -> String {
    let mut sections = Vec::new();
    
    for (file_path, content) in files {
        // Get relative path from current working directory
        let rel_path = if let Ok(cwd) = std::env::current_dir() {
            file_path.strip_prefix(&cwd)
                .unwrap_or(file_path)
                .display()
                .to_string()
        } else {
            file_path.display().to_string()
        };
        
        let section = format!(
            "---\nSource: {}\n---\n{}\n",
            rel_path,
            content.trim()
        );
        sections.push(section);
    }
    
    sections.join("\n")
}
