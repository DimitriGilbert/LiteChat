// src/lib/litechat/useMarkdownParser.ts
import { useMemo } from "react";
// Import Remarkable class only
import { Remarkable } from "remarkable";
import { linkify } from "remarkable/linkify";
import type { Token } from "remarkable/lib";

export interface CodeBlockData {
  type: "code";
  lang: string | undefined;
  code: string; // Pass raw code content
}

export type ParsedContent = (string | CodeBlockData)[];

const remarkableOptions: Remarkable.Options = {
  html: false, // Keep HTML rendering disabled for security
  xhtmlOut: false,
  breaks: true,
  langPrefix: "",
  typographer: false,
  quotes: "“”‘’",
  highlight: undefined,
};

// Create the instance
const md = new Remarkable(remarkableOptions).use(linkify);

function isFenceToken(
  token: Token,
): token is Token & { type: "fence"; params: string; content: string } {
  return token.type === "fence";
}

export function useMarkdownParser(
  markdownString: string | null | undefined,
): ParsedContent {
  console.log("[useMarkdownParser] Input:", markdownString); // Keep logging input

  const parsedContent = useMemo((): ParsedContent => {
    if (!markdownString) {
      return [];
    }
    try {
      const env = { references: {} };
      const tokens = md.parse(markdownString, env);
      const result: ParsedContent = [];
      let currentHtmlBuffer = "";
      let currentTokenIndex = 0;

      while (currentTokenIndex < tokens.length) {
        const token = tokens[currentTokenIndex];

        if (isFenceToken(token)) {
          // Push any accumulated HTML before the code block
          if (currentHtmlBuffer) {
            result.push(currentHtmlBuffer);
            currentHtmlBuffer = "";
          }
          // Push the code block data with raw content
          result.push({
            type: "code",
            lang: token.params?.split(" ")[0] || undefined,
            code: token.content, // Pass raw code content, DO NOT unescape here
          });
          currentTokenIndex++;
        } else {
          // Accumulate tokens to be rendered as HTML
          const nonFenceTokens: Token[] = [];
          while (
            currentTokenIndex < tokens.length &&
            !isFenceToken(tokens[currentTokenIndex])
          ) {
            nonFenceTokens.push(tokens[currentTokenIndex]);
            currentTokenIndex++;
          }
          // Render the accumulated non-fence tokens to HTML
          if (nonFenceTokens.length > 0) {
            currentHtmlBuffer += md.renderer.render(
              nonFenceTokens,
              remarkableOptions,
              env,
            );
          }
        }
      }

      // Push any remaining HTML buffer
      if (currentHtmlBuffer) {
        result.push(currentHtmlBuffer);
      }

      return result;
    } catch (error) {
      console.error("Remarkable parsing error:", error);
      // Fallback: Render the raw input string within a <pre> tag for basic display
      const safeMarkdownString = String(markdownString ?? "");
      // Basic manual escaping for safety, avoiding Remarkable.utils
      const escapedString = safeMarkdownString
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      return [`<pre>${escapedString}</pre>`];
    }
  }, [markdownString]);

  console.log("[useMarkdownParser] Output:", parsedContent); // Keep logging output
  return parsedContent;
}
