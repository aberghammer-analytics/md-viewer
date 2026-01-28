# md-viewer

A minimal, fast CLI tool to view and edit markdown files. Point at a file, get an instant native preview window.

```
md report.md
```

## Features

- Instant native preview window
- Toggle between rendered preview and editable source
- Live preview while editing
- Dark mode by default (retro CRT terminal aesthetic)
- GitHub-flavored markdown support

## Installation

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- Platform-specific dependencies for Tauri:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: See [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-linux)
  - **Windows**: See [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-windows)

### Install via Homebrew (macOS)

```bash
brew tap aberghammer-analytics/md-viewer https://github.com/aberghammer-analytics/md-viewer.git
brew install --cask md-viewer
```

This installs the `md` command globally.

### Build from source

```bash
# Clone the repo
git clone https://github.com/aberghammer-analytics/md-viewer.git
cd md-viewer

# Install dependencies
npm install

# Build the release binary
npm run build
```

The binary will be at:
- **macOS**: `src-tauri/target/release/md-viewer`
- **Linux**: `src-tauri/target/release/md-viewer`
- **Windows**: `src-tauri/target/release/md-viewer.exe`

### Add to PATH

#### macOS / Linux

```bash
# Option 1: Symlink to /usr/local/bin
sudo ln -s "$(pwd)/src-tauri/target/release/md-viewer" /usr/local/bin/md

# Option 2: Add to your shell config (~/.zshrc or ~/.bashrc)
alias md="/path/to/md-viewer/src-tauri/target/release/md-viewer"
```

#### Windows

Add the release folder to your PATH, or create a batch file in a PATH directory:

```batch
@echo off
"C:\path\to\md-viewer\src-tauri\target\release\md-viewer.exe" %*
```

## Usage

```bash
# Open a file in preview mode
md README.md

# Open directly in edit mode
md README.md --edit

# Force light theme
md README.md --theme light

# Create a new file (opens blank editor)
md
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save file |
| `Cmd/Ctrl + E` | Toggle edit/preview |
| `Cmd/Ctrl + W` | Close window |

## Development

```bash
# Run in development mode with hot reload
npm run dev
```

## License

MIT
