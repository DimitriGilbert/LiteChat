// src/lib/litechat/useMarkdownParser.ts
import { useMemo } from "react";
import { Remarkable } from "remarkable";
import { linkify } from "remarkable/linkify";
import hljs from "highlight.js"; // Use default import

// Configure Remarkable instance once
const md = new Remarkable({
  html: false, // Disable HTML tags in source
  xhtmlOut: false, // Don't output XHTML
  breaks: true, // Convert '\n' in paragraphs into <br>
  langPrefix: "hljs language-", // CSS language prefix for highlight.js
  typographer: false, // Enable some language-neutral replacement + quotes beautification
  quotes: "“”‘’",
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true })
          .value;
      } catch (err) {
        console.error("Highlight.js error:", err);
      }
    }

    try {
      return hljs.highlightAuto(str).value;
    } catch (err) {
      console.error("Highlight.js auto-highlight error:", err);
    }

    return ""; // use external default escaping
  },
}).use(linkify);

export function useMarkdownParser(markdownString: string | null | undefined) {
  const html = useMemo(() => {
    if (!markdownString) {
      return "";
    }
    try {
      return md.render(markdownString);
    } catch (error) {
      console.error("Remarkable rendering error:", error);
      return `<p>Error rendering Markdown.</p><pre><code>${markdownString}</code></pre>`; // Fallback
    }
  }, [markdownString]);

  return html;
}
