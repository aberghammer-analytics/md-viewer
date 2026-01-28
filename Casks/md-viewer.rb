cask "md-viewer" do
  version "0.1.0"
  sha256 "75fd6effbf1b01304fd7610254d499eb5de9dd49aa78ba523bbbddae3bced5c6"

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
