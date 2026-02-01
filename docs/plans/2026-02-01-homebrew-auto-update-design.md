# Homebrew Cask Auto-Update via GitHub Actions

## Goal

After pushing a version tag (e.g. `v0.2.0`), the Homebrew Cask file is automatically updated with the new version and SHA256 hash — no manual steps required.

## Approach

Self-contained tap: the `Casks/` directory lives in this repo. Users install via:

```bash
brew tap aberghammer-analytics/md-viewer https://github.com/aberghammer-analytics/md-viewer
brew install --cask md-viewer
```

## Changes

### 1. `release.yml` — Add `update-homebrew` job

A new job runs after the existing `build-tauri` job completes:

```
build-tauri (existing) → update-homebrew (new)
```

The `update-homebrew` job:
- Runs on `macos-latest`
- Extracts the version from the git tag (strips `v` prefix)
- Downloads the universal DMG from the GitHub Release via `gh` CLI
- Computes SHA256 of the DMG
- Updates `version` and `sha256` lines in `Casks/md-viewer.rb` using `sed`
- Commits and pushes to the default branch as `github-actions[bot]`

### 2. `Casks/md-viewer.rb` — No changes needed

The file is already structured with `version` and `sha256` on separate lines, and the URL uses `#{version}` interpolation. No modifications required.

## Details

- Uses `GITHUB_TOKEN` (already has `contents: write` permission)
- The `needs: build-tauri` dependency ensures DMG assets are uploaded before download
- Targets DMG filename: `md-viewer_{version}_universal.dmg`
- Automated commit uses `github-actions[bot]` committer identity
