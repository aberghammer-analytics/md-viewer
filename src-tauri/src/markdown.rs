use comrak::{markdown_to_html, Options};

/// Converts markdown content to HTML using GitHub-flavored markdown extensions
pub fn render_to_html(content: &str) -> String {
    let mut options = Options::default();

    // Enable GitHub-flavored markdown extensions
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    options.extension.header_ids = Some("heading-".to_string());

    // Enable raw HTML support
    options.render.unsafe_ = true;

    markdown_to_html(content, &options)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_markdown() {
        let md = "# Hello World";
        let html = render_to_html(md);
        assert!(html.contains("<h1"));
        assert!(html.contains("Hello World"));
    }

    #[test]
    fn test_gfm_table() {
        let md = "| A | B |\n|---|---|\n| 1 | 2 |";
        let html = render_to_html(md);
        assert!(html.contains("<table>"));
    }

    #[test]
    fn test_tasklist() {
        let md = "- [x] Done\n- [ ] Todo";
        let html = render_to_html(md);
        assert!(html.contains("checked"));
    }
}
