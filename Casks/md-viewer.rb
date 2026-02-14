cask "md-viewer" do
  version "0.1.2"
  sha256 "6074a74fc202178e2fc6d13d252ea605daccedba9775fcfc9615b9fdf5d95990"

  url "https://github.com/aberghammer-analytics/md-viewer/releases/download/v#{version}/md-viewer_#{version}_universal.dmg"
  name "md-viewer"
  desc "A minimal, fast CLI tool to view and edit markdown files"
  homepage "https://github.com/aberghammer-analytics/md-viewer"

  app "md-viewer.app"
  binary "#{appdir}/md-viewer.app/Contents/MacOS/md-viewer", target: "md"

  zap trash: [
    "~/Library/Preferences/com.md-viewer.app.plist",
    "~/Library/Saved Application State/com.md-viewer.app.savedState",
  ]
end
