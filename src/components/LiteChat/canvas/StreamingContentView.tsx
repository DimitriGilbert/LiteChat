// src/components/LiteChat/canvas/StreamingContentView.tsx
import React, { useMemo } from "react";
import {
  useMarkdownParser,
  CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "../common/CodeBlockRenderer";
import { useSettingsStore } from "@/store/settings.store";
import { cn } from "@/lib/utils";

interface StreamingContentViewProps {
  // Changed prop name from 'content' to 'markdownContent'
  markdownContent: string | null | undefined;
  isStreaming?: boolean;
  className?: string;
}

export const StreamingContentView: React.FC<StreamingContentViewProps> = ({
  markdownContent,
  isStreaming = false,
  className,
}) => {
  const enableStreamingMarkdown = useSettingsStore(
    (state) => state.enableStreamingMarkdown,
  );
  const parsedContent = useMarkdownParser(markdownContent);

  // Memoize the rendered content to avoid re-rendering unchanged parts
  const renderedContent = useMemo(() => {
    return parsedContent.map((item, index) => {
      if (typeof item === "string") {
        // Render HTML string directly
        return (
          <div
            key={`html-${index}`}
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: item }}
          />
        );
      } else if (item.type === "code") {
        // Render CodeBlockData using CodeBlockRenderer
        const codeData = item as CodeBlockData;
        return (
          <CodeBlockRenderer
            key={`code-${index}`}
            // Pass the language prop correctly (using codeData.lang)
            lang={codeData.lang}
            code={codeData.code}
            // isStreaming={isStreaming && index === parsedContent.length - 1} // Only last block might be streaming
          />
        );
      }
      return null;
    });
  }, [parsedContent, isStreaming]); // Depend on parsedContent and isStreaming

  // Fallback for empty content
  if (!markdownContent?.trim()) {
    return (
      <div className={cn("text-muted-foreground italic", className)}>
        {isStreaming ? "Generating response..." : "No response content."}
      </div>
    );
  }

  // If streaming markdown is disabled, render raw text
  if (isStreaming && !enableStreamingMarkdown) {
    return (
      <pre className={cn("whitespace-pre-wrap text-sm", className)}>
        {markdownContent}
      </pre>
    );
  }

  return <div className={cn(className)}>{renderedContent}</div>;
};
