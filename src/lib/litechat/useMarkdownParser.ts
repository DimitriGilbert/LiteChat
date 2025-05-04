// src/lib/litechat/useMarkdownParser.ts
import { useMemo } from "react";
import MarkdownIt from "markdown-it";

export interface CodeBlockData {
  type: "code";
  lang: string | undefined;
  code: string;
}

export type ParsedContent = (string | CodeBlockData)[];

// Create a MarkdownIt parser instance with desired options
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

export function useMarkdownParser(
  markdownString: string | null | undefined,
): ParsedContent {
  const parsedContent = useMemo((): ParsedContent => {
    if (!markdownString) {
      return [];
    }
    try {
      // Parse the markdown string into tokens
      const tokens = md.parse(markdownString, {});
      const result: ParsedContent = [];
      let currentHtmlBuffer = "";
      let index = 0;

      while (index < tokens.length) {
        const token = tokens[index] as any;

        if (token.type === "fence") {
          // If there's accumulated HTML, flush it as a string
          if (currentHtmlBuffer) {
            result.push(currentHtmlBuffer);
            currentHtmlBuffer = "";
          }
          // Extract language from the fence info
          const lang = token.info?.split(" ")[0] || undefined;
          // Push the code block content as a CodeBlockData object
          result.push({
            type: "code",
            lang: lang,
            code: token.content,
          });
          index++;
        } else {
          // Accumulate non-code tokens
          const nonFenceTokens: any[] = [];
          while (
            index < tokens.length &&
            (tokens[index] as any).type !== "fence"
          ) {
            nonFenceTokens.push(tokens[index]);
            index++;
          }
          if (nonFenceTokens.length > 0) {
            // Render the non-code tokens to HTML and append
            currentHtmlBuffer += md.renderer.render(
              nonFenceTokens,
              md.options,
              {},
            );
          }
        }
      }

      // Flush any remaining HTML content
      if (currentHtmlBuffer) {
        result.push(currentHtmlBuffer);
      }

      return result;
    } catch (error) {
      console.error("Markdown parsing error:", error);
      // Fallback: escape and wrap in <pre>
      const safeMarkdownString = String(markdownString ?? "");
      const escapedString = safeMarkdownString
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      return [`<pre>${escapedString}</pre>`];
    }
  }, [markdownString]);

  return parsedContent;
}
