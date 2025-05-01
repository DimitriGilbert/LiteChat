// src/components/LiteChat/canvas/StreamingContentView.tsx
// Entire file content provided
import React, { useMemo } from "react";
import {
  useMarkdownParser,
  CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "../common/CodeBlockRenderer";
import { useSettingsStore } from "@/store/settings.store";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow"

interface StreamingContentViewProps {
  markdownContent: string | null | undefined;
  isStreaming?: boolean;
  className?: string;
}

export const StreamingContentView: React.FC<StreamingContentViewProps> = ({
  markdownContent,
  isStreaming = false,
  className,
}) => {
  // Use useShallow to select multiple state values efficiently
  // Removed enableStreamingCodeBlockParsing as it doesn't exist in the store
  const { enableStreamingMarkdown } = useSettingsStore(
    useShallow((state) => ({
      enableStreamingMarkdown: state.enableStreamingMarkdown,
      // Removed enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
    })),
  );

  // Only parse if streaming markdown is enabled
  const parsedContent = useMarkdownParser(
    enableStreamingMarkdown ? markdownContent : null,
  );

  // Memoize the rendered content to avoid re-rendering unchanged parts
  const renderedContent = useMemo(() => {
    // If streaming markdown is disabled, return raw text wrapped in pre
    if (!enableStreamingMarkdown) {
      return (
        <pre className={cn("whitespace-pre-wrap text-sm", className)}>
          {markdownContent}
        </pre>
      );
    }

    // If streaming markdown is enabled, render parsed content
    return parsedContent.map((item, index) => {
      if (typeof item === "string") {
        return (
          <div
            key={`html-${index}`}
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: item }}
          />
        );
      } else if (item.type === "code") {
        const codeData = item as CodeBlockData;
        // CodeBlockRenderer now internally checks enableStreamingCodeBlockParsing
        // which was removed, so it will rely on its own logic or default behavior
        return (
          <CodeBlockRenderer
            key={`code-${index}`}
            lang={codeData.lang}
            code={codeData.code}
          />
        );
      }
      return null;
    });
  }, [parsedContent, enableStreamingMarkdown, markdownContent, className]);

  // Fallback for empty content
  if (!markdownContent?.trim()) {
    return (
      <div className={cn("text-muted-foreground italic", className)}>
        {isStreaming ? "Generating response..." : "No response content."}
      </div>
    );
  }

  return <div className={cn(className)}>{renderedContent}</div>;
};
