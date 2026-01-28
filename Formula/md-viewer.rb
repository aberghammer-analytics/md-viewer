class MdViewer < Formula
  desc "A minimal, fast CLI tool to view and edit markdown files"
  homepage "https://github.com/aberghammer-analytics/md-viewer"
  version "0.1.0"
  license "MIT"

  if OS.mac?
    url "https://github.com/aberghammer-analytics/md-viewer/releases/download/v#{version}/md-viewer_#{version}_universal.dmg"
    sha256 "75fd6effbf1b01304fd7610254d499eb5de9dd49aa78ba523bbbddae3bced5c6"
  end

  def install
    prefix.install "md-viewer.app"
    bin.install_symlink prefix/"md-viewer.app/Contents/MacOS/md-viewer" => "md"
  end

  test do
    system "#{bin}/md", "--version"
  end
end
