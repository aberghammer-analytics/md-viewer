# Fix Blank Screen Race Condition — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the race condition that causes a blank screen on first load by switching from push-based (event) to pull-based (command) initialization.

**Architecture:** The backend stores `AppInit` in Tauri managed state. The frontend calls a `get_init_state` command when it's ready, replacing the unreliable 100ms-delayed event emission.

**Tech Stack:** Rust/Tauri backend, vanilla JS frontend

**Security note:** The existing `innerHTML` usage for preview rendering is safe — all HTML is sanitized server-side via ammonia in `markdown.rs:sanitize_html()` before reaching the frontend. This plan does not change any innerHTML patterns.

---

### Task 1: Add `get_init_state` command to backend

**Files:**
- Modify: `src-tauri/src/main.rs` (entire file — restructure init flow)
- Modify: `src-tauri/src/commands.rs` (add new command)

**Step 1: Move `AppInit` to `commands.rs` and add the new command**

In `src-tauri/src/commands.rs`, add at the top of the file (after existing imports):

```rust
use std::sync::Arc;

/// Initial application state sent to the frontend
#[derive(Debug, Serialize, Clone)]
pub struct AppInit {
    pub file_path: Option<String>,
    pub edit_mode: bool,
    pub theme: String,
}

/// Returns the initial application state (file path, edit mode, theme).
/// Called by the frontend when it's ready, replacing the old event-based init.
#[tauri::command]
pub fn get_init_state(state: tauri::State<'_, Arc<AppInit>>) -> AppInit {
    state.inner().as_ref().clone()
}
```

Note: `theme` becomes a `String` (instead of an enum) to simplify serialization. The `AppInit` struct in `main.rs` will be removed — this is the canonical one now.

**Step 2: Update `main.rs` to use managed state instead of event emission**

Replace the full contents of `main.rs` with:

```rust
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
```

Key changes:
- Removed `use tauri::Emitter` (no longer emitting events)
- Removed `Serialize` derive from `Theme` (no longer serialized directly)
- Removed `AppInit` struct (moved to `commands.rs`)
- Replaced thread spawn + sleep + emit with `.manage(init_state)`
- Added `commands::get_init_state` to `generate_handler!`

**Step 3: Run Rust tests to verify nothing broke**

Run: `cd /Users/anthonyberghammer/Documents/Projects/MarkdownViewer/markdown-viewer/src-tauri && cargo test`
Expected: All existing tests pass (markdown tests are unchanged)

**Step 4: Run `cargo check` to verify compilation**

Run: `cd /Users/anthonyberghammer/Documents/Projects/MarkdownViewer/markdown-viewer/src-tauri && cargo check`
Expected: No errors

**Step 5: Commit backend changes**

```bash
git add src-tauri/src/main.rs src-tauri/src/commands.rs
git commit -m "fix: replace event-based init with command-based init (backend)

Move AppInit to commands.rs, add get_init_state command, store init
state via Tauri managed state. Remove thread spawn + 100ms sleep +
event emission that caused blank screen race condition on cold starts."
```

---

### Task 2: Update frontend to pull init state

**Files:**
- Modify: `src/main.js` (replace event listener with invoke call)

**Step 1: Replace the event-based init with a command call**

In `src/main.js`, replace the `listen('app-init', ...)` block (lines 431-455) with:

```javascript
    // Pull init state from backend (replaces old event-based approach)
    const { file_path, edit_mode, theme } = await invoke('get_init_state');

    // Apply theme from CLI args
    applyTheme(theme);

    // Load file if provided, otherwise start blank editor
    if (file_path) {
      await loadFile(file_path);
      if (edit_mode) {
        await setEditMode(true);
      }
    } else {
      state.filename = 'Untitled';
      state.currentContent = '';
      state.originalContent = '';
      state.filePath = null;
      elements.filename.textContent = 'Untitled';
      // Note: empty-state text set via textContent-safe pattern in existing code
      await setEditMode(true);
    }
```

Also remove dead references to `listen`:
- Line 72: change `let invoke, listen, appWindow;` to `let invoke, appWindow;`
- Line 418: remove `listen = tauri.event.listen;`

**Step 2: Verify `setEditMode(true)` is now properly awaited**

The old code called `setEditMode(true)` without `await` (line 443). The new code adds `await` — this fixes a minor secondary bug where edit mode toggling could race with file rendering.

**Step 3: Build the full app to verify**

Run: `cd /Users/anthonyberghammer/Documents/Projects/MarkdownViewer/markdown-viewer && cargo tauri build --debug`
Expected: Build succeeds

**Step 4: Manual test**

1. Run: `./src-tauri/target/debug/md-viewer test.md`
2. Verify: File content renders immediately, no blank screen
3. Close the app
4. Run again immediately — verify it still works on warm start
5. Test with `--edit` flag: `./src-tauri/target/debug/md-viewer test.md --edit`
6. Verify: Opens directly in edit mode with file content
7. Test with no file: `./src-tauri/target/debug/md-viewer`
8. Verify: Opens in edit mode with "Untitled" / empty state

**Step 5: Commit frontend changes**

```bash
git add src/main.js
git commit -m "fix: replace event listener with direct invoke for init state (frontend)

Frontend now pulls init state via get_init_state command when ready,
eliminating the race condition where the app-init event could fire
before the listener was registered. Also properly awaits setEditMode."
```

---

### Task 3: Clean up and verify

**Files:**
- Review: `src-tauri/src/main.rs`, `src-tauri/src/commands.rs`, `src/main.js`

**Step 1: Run full Rust test suite**

Run: `cd /Users/anthonyberghammer/Documents/Projects/MarkdownViewer/markdown-viewer/src-tauri && cargo test`
Expected: All tests pass

**Step 2: Run clippy for lint check**

Run: `cd /Users/anthonyberghammer/Documents/Projects/MarkdownViewer/markdown-viewer/src-tauri && cargo clippy -- -D warnings`
Expected: No warnings

**Step 3: Final manual test — cold start simulation**

1. Kill any running md-viewer processes
2. Run: `./src-tauri/target/debug/md-viewer test.md`
3. Verify: Content renders on first load, every time
4. Repeat 3-5 times to confirm reliability

**Step 4: Verify no dead code remains**

- `Emitter` import removed from `main.rs`
- `listen` variable removed from `main.js`
- No references to `app-init` event remain in codebase
- `Serialize` derive removed from `Theme` enum (only needed on `AppInit` which is now in `commands.rs`)

Run: Search for leftover references
```bash
rg "app-init" src-tauri/src/ src/
rg "listen" src/main.js
```
Expected: No matches for `app-init`. No references to `listen` in `main.js`.
