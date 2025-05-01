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
import { useShallow } from "zustand/react/shallow";

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
  const { enableStreamingMarkdown, enableStreamingCodeBlockParsing } =
    useSettingsStore(
      useShallow((state) => ({
        enableStreamingMarkdown: state.enableStreamingMarkdown,
        // Get the new setting
        enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
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
        const languageClass = codeData.lang
          ? `language-${codeData.lang}`
          : "language-plaintext";
        // Conditionally render CodeBlockRenderer or basic pre/code
        if (enableStreamingCodeBlockParsing) {
          return (
            <CodeBlockRenderer
              key={`code-${index}`}
              lang={codeData.lang}
              code={codeData.code}
            />
          );
        } else {
          // Render basic pre/code block if setting is off
          return (
            <pre
              key={`pre-${index}`}
              className="code-block-container my-4 border border-border rounded-lg overflow-x-auto"
            >
              <div className="code-block-header flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                <div className="text-sm font-medium">
                  {codeData.lang ? codeData.lang.toUpperCase() : "CODE"}
                </div>
                {/* Optionally add basic copy button here too */}
              </div>
              <code
                className={cn(
                  languageClass,
                  "block p-4 font-mono text-sm leading-relaxed",
                )}
              >
                {codeData.code}
              </code>
            </pre>
          );
        }
      }
      return null;
    });
  }, [
    parsedContent,
    enableStreamingMarkdown,
    enableStreamingCodeBlockParsing, // Add dependency
    markdownContent,
    className,
  ]);

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
