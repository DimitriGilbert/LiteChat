// src/lib/markdown-parser.ts
import { Remarkable } from "remarkable";
import hljs from "highlight.js";
import ReactDOMServer from "react-dom/server";
import { CodeBlock } from "@/components/lite-chat/code-block"; // Adjust path if needed

// Create and configure the Remarkable instance ONCE
const mdParser = new Remarkable({
  html: false, // Keep false for security
  breaks: true,
  typographer: false, // Consistent setting
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true })
          .value;
      } catch (__) {
        /* ignore */
      }
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch (__) {
      /* ignore */
    }
    // Use the static Remarkable.utils for escaping
    return Remarkable.utils.escapeHtml(str);
  },
});

// Apply the custom fence rule to the shared instance
mdParser.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.params ? token.params.split(/\s+/g)[0] : "";
  const codeContent = token.content;
  // Render the CodeBlock component to an HTML string
  const codeBlockHtml = ReactDOMServer.renderToString(
    <CodeBlock code={codeContent} language={lang} />,
  );
  // Return the rendered HTML string
  return codeBlockHtml;
};

// Export the configured instance
export const sharedMdParser = mdParser;
