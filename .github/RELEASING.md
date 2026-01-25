# Releasing md-viewer

## Version Bump Checklist

1. Update version in these files:
   - `src-tauri/Cargo.toml` (version field)
   - `src-tauri/tauri.conf.json` (version field)
   - `package.json` (version field)

2. Update CHANGELOG.md (if you have one)

3. Commit version bump:
   ```bash
   git add -A
   git commit -m "chore: bump version to X.Y.Z"
   ```

4. Create and push tag:
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin main --tags
   ```

5. Wait for GitHub Actions to build and publish release

6. Update Homebrew formula:
   - Download new DMG from release
   - Get SHA256: `shasum -a 256 md-viewer_X.Y.Z_universal.dmg`
   - Update `Formula/md-viewer.rb` in homebrew-md-viewer repo:
     - Update `version`
     - Update `sha256`
   - Commit and push

## Testing Release Locally

Before tagging, test the build:
```bash
npm run build
```

Test the resulting app in `src-tauri/target/release/bundle/`.
