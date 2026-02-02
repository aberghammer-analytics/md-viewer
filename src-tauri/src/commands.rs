use crate::markdown::render_to_html;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Allowed file extensions for markdown-related files
const ALLOWED_EXTENSIONS: &[&str] = &["md", "markdown", "mdx", "mdown", "txt"];

/// Represents the content loaded from a markdown file
#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub filename: String,
    pub content: String,
    pub html: String,
}

/// Checks if a file path has an allowed markdown-related extension
fn has_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ALLOWED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Loads a markdown file and returns its content along with rendered HTML.
/// Validates the path to prevent directory traversal and restricts to markdown file types.
#[tauri::command]
pub fn load_file(path: String) -> Result<FileContent, String> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !path_obj.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    // Canonicalize to resolve symlinks and traversal sequences
    let canonical = fs::canonicalize(path_obj).map_err(|e| format!("Invalid file path: {}", e))?;

    if !has_allowed_extension(&canonical) {
        return Err(format!(
            "Unsupported file type. Allowed extensions: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    let content =
        fs::read_to_string(&canonical).map_err(|e| format!("Failed to read file: {}", e))?;

    let filename = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let html = render_to_html(&content);

    Ok(FileContent {
        path: canonical.to_string_lossy().to_string(),
        filename,
        content,
        html,
    })
}

/// Saves content to a file.
/// Validates the path to prevent directory traversal and restricts to markdown file types.
#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    let path_obj = Path::new(&path);

    if !has_allowed_extension(path_obj) {
        return Err(format!(
            "Unsupported file type. Allowed extensions: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    // Canonicalize the parent directory to prevent traversal.
    // The file itself may not exist yet (Save As), so we check the parent.
    let parent = path_obj
        .parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?;

    let canonical_parent =
        fs::canonicalize(parent).map_err(|e| format!("Invalid directory path: {}", e))?;

    let filename = path_obj
        .file_name()
        .ok_or_else(|| "Invalid file path: no filename".to_string())?;

    let canonical_path = canonical_parent.join(filename);

    fs::write(&canonical_path, &content).map_err(|e| format!("Failed to save file: {}", e))
}

/// Renders markdown content to sanitized HTML
#[tauri::command]
pub fn render_markdown(content: String) -> String {
    render_to_html(&content)
}
