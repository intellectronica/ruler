use anyhow::Result;
use std::path::Path;
use std::fs;

const RULER_GITIGNORE_START: &str = "# START Ruler Generated Files";
const RULER_GITIGNORE_END: &str = "# END Ruler Generated Files";

/// Updates the .gitignore file with generated paths in a managed block
pub fn update_gitignore(project_root: &Path, generated_paths: &[String]) -> Result<()> {
    let gitignore_path = project_root.join(".gitignore");
    
    // Read existing .gitignore content if it exists
    let existing_content = if gitignore_path.exists() {
        fs::read_to_string(&gitignore_path)?
    } else {
        String::new()
    };

    // Find the managed block
    let lines: Vec<&str> = existing_content.lines().collect();
    let mut new_content = Vec::new();
    let mut in_ruler_block = false;
    let mut found_ruler_block = false;

    for line in &lines {
        if line.trim() == RULER_GITIGNORE_START {
            in_ruler_block = true;
            found_ruler_block = true;
            new_content.push(line.to_string());
            // Add the generated paths
            let mut sorted_paths = generated_paths.to_vec();
            sorted_paths.sort();
            for path in sorted_paths {
                new_content.push(path.clone());
            }
        } else if line.trim() == RULER_GITIGNORE_END {
            in_ruler_block = false;
            new_content.push(line.to_string());
        } else if !in_ruler_block {
            new_content.push(line.to_string());
        }
        // Skip lines inside the ruler block (they will be replaced)
    }

    // If no ruler block was found, add one at the end
    if !found_ruler_block {
        if !new_content.is_empty() && !new_content.last().unwrap().is_empty() {
            new_content.push(String::new()); // Add blank line before ruler block
        }
        new_content.push(RULER_GITIGNORE_START.to_string());
        let mut sorted_paths = generated_paths.to_vec();
        sorted_paths.sort();
        for path in sorted_paths {
            new_content.push(path);
        }
        new_content.push(RULER_GITIGNORE_END.to_string());
    }

    // Write the updated content
    let final_content = new_content.join("\n");
    fs::write(&gitignore_path, final_content)?;

    Ok(())
}
