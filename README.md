# md-viewer

A minimal, fast CLI tool to view and edit markdown files. Point at a file, get an instant native preview window.

```
md report.md
```


## Features

- **Instant native preview** — opens a lightweight WebView window, not a browser
- **Edit mode with live preview** — toggle between rendered preview and raw source; changes render in real-time
- **Dark mode with CRT aesthetic** — scanline overlay, subtle text glow, and vignette effect. Light mode too
- **GitHub-flavored markdown** — tables, task lists, strikethrough, footnotes, autolinks, code blocks
- **Save & Save As** — `Cmd+S` to save; new documents get a save dialog
- **Scroll sync** — scroll position preserved when toggling between edit and preview
- **Close protection** — modal confirmation if you close with unsaved changes
- **External link handling** — links open in your default browser with optional confirmation
- **Security hardened** — HTML sanitized with ammonia, path traversal prevention, file extension allowlisting

## Installation

### Homebrew (macOS)

```bash
brew tap aberghammer-analytics/md-viewer https://github.com/aberghammer-analytics/md-viewer.git
brew install --cask md-viewer
```

### Build from source

Requires [Rust](https://rustup.rs/) (1.70+) and [Node.js](https://nodejs.org/) (18+).

```bash
git clone https://github.com/aberghammer-analytics/md-viewer.git
cd md-viewer
npm install
npm run build
```

## Usage

```bash
md file.md                    # Open file in preview mode
md file.md --edit             # Open directly in edit mode
md file.md --theme light      # Force light theme
md                            # New blank document
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save file |
| `Cmd/Ctrl + E` | Toggle edit/preview |
| `Cmd/Ctrl + W` | Close window |

## Development

```bash
npm run dev
```

## License

MIT
