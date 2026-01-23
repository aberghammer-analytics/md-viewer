use crate::markdown::render_to_html;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Represents the content loaded from a markdown file
#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub filename: String,
    pub content: String,
    pub html: String,
}

/// Loads a markdown file and returns its content along with rendered HTML
#[tauri::command]
pub fn load_file(path: String) -> Result<FileContent, String> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !path_obj.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let filename = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let html = render_to_html(&content);

    Ok(FileContent {
        path,
        filename,
        content,
        html,
    })
}

/// Saves content to a file
#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to save file: {}", e))
}

/// Renders markdown content to HTML
#[tauri::command]
pub fn render_markdown(content: String) -> String {
    render_to_html(&content)
}
