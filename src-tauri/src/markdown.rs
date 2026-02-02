use ammonia::Builder;
use comrak::{markdown_to_html, Options};
use std::collections::HashSet;

/// Converts markdown content to sanitized HTML using GitHub-flavored markdown extensions.
/// Raw HTML in the markdown source is parsed by comrak, then sanitized by ammonia
/// to strip dangerous elements (script tags, event handlers, etc.) while preserving
/// safe HTML commonly used in markdown documents.
pub fn render_to_html(content: &str) -> String {
    let mut options = Options::default();

    // Enable GitHub-flavored markdown extensions
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    options.extension.header_ids = Some(String::new());

    // Allow raw HTML parsing — ammonia sanitizes the output
    options.render.unsafe_ = true;

    let raw_html = markdown_to_html(content, &options);

    sanitize_html(&raw_html)
}

/// Sanitizes HTML output using ammonia with an allowlist tuned for rendered markdown.
/// Permits standard markdown elements plus task list checkboxes and header anchors,
/// while stripping script tags, event handlers, and other XSS vectors.
fn sanitize_html(html: &str) -> String {
    let extra_tags: HashSet<&str> = ["input"].into_iter().collect();
    let input_attrs: HashSet<&str> = ["type", "checked", "disabled"].into_iter().collect();
    let id_attrs: HashSet<&str> = ["id"].into_iter().collect();

    let result = Builder::default()
        .add_tags(&extra_tags)
        .add_tag_attributes("input", &input_attrs)
        .add_generic_attributes(&id_attrs) // For header anchor links
        .clean(html)
        .to_string();

    result
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

    #[test]
    fn test_script_tag_stripped() {
        let md = "<script>alert('xss')</script>";
        let html = render_to_html(md);
        assert!(!html.contains("<script>"));
        assert!(!html.contains("alert"));
    }

    #[test]
    fn test_event_handler_stripped() {
        let md = "<img src=\"x\" onerror=\"alert('xss')\">";
        let html = render_to_html(md);
        assert!(!html.contains("onerror"));
        assert!(!html.contains("alert"));
    }

    #[test]
    fn test_safe_html_preserved() {
        let md = "This has <em>emphasis</em> and <strong>bold</strong>";
        let html = render_to_html(md);
        assert!(html.contains("<em>emphasis</em>"));
        assert!(html.contains("<strong>bold</strong>"));
    }
}
