cask "md-viewer" do
  version "0.1.1"
  sha256 "9a0e857b481ec895c93951f2b915e00b41834dd0f4babd157be6cbf781386da8"

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
