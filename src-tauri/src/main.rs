#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod markdown;

use clap::{Parser, ValueEnum};
use commands::AppInit;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

/// Valid theme options
#[derive(Debug, Clone, ValueEnum)]
enum Theme {
    Light,
    Dark,
}

impl std::fmt::Display for Theme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Theme::Light => write!(f, "light"),
            Theme::Dark => write!(f, "dark"),
        }
    }
}

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
    #[arg(short, long, value_enum, default_value_t = Theme::Dark)]
    theme: Theme,
}

fn main() {
    let cli = Cli::parse();

    let file_path = cli.file.map(|p| {
        if p.is_absolute() {
            p
        } else {
            std::env::current_dir().map(|cwd| cwd.join(&p)).unwrap_or(p)
        }
        .to_string_lossy()
        .to_string()
    });

    let init_state = Arc::new(AppInit {
        file_path: file_path.clone(),
        edit_mode: cli.edit,
        theme: cli.theme.to_string(),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(init_state)
        .invoke_handler(tauri::generate_handler![
            commands::load_file,
            commands::save_file,
            commands::render_markdown,
            commands::get_init_state,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            let title = file_path
                .as_ref()
                .and_then(|p| std::path::Path::new(p).file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled");
            window.set_title(title).ok();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
