// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod markdown;

use clap::Parser;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

/// A minimal, fast CLI tool to view and edit markdown files
#[derive(Parser, Debug)]
#[command(name = "md-viewer")]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Markdown file to open
    file: Option<PathBuf>,

    /// Open directly in edit mode
    #[arg(short, long)]
    edit: bool,

    /// Set the theme (light or dark)
    #[arg(short, long, default_value = "dark")]
    theme: String,
}

/// Initial application state sent to the frontend
#[derive(Debug, Serialize, Clone)]
struct AppInit {
    file_path: Option<String>,
    edit_mode: bool,
    theme: String,
}

fn main() {
    let cli = Cli::parse();

    // Convert relative path to absolute if a file was provided
    let file_path = cli.file.map(|p| {
        if p.is_absolute() {
            p
        } else {
            std::env::current_dir().map(|cwd| cwd.join(&p)).unwrap_or(p)
        }
        .to_string_lossy()
        .to_string()
    });

    let init_state = AppInit {
        file_path: file_path.clone(),
        edit_mode: cli.edit,
        theme: cli.theme,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_file,
            commands::save_file,
            commands::render_markdown,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            // Set window title based on file
            let title = file_path
                .as_ref()
                .and_then(|p| std::path::Path::new(p).file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled");
            window.set_title(title).ok();

            // Emit initial state after a short delay to ensure frontend is ready
            let window_clone = window.clone();
            let init_state_for_emit = init_state.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(100));
                window_clone.emit("app-init", init_state_for_emit).ok();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
