// src/components/LiteChat/canvas/StreamingContentView.tsx
// FULL FILE
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  useMarkdownParser,
  CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { useSettingsStore } from "@/store/settings.store";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";

interface StreamingContentViewProps {
  markdownContent: string | null | undefined;
  isStreaming?: boolean;
  className?: string;
}

// Helper to render a single parsed block (memoized internally if CodeBlockRenderer)
const renderBlock = (
  item: string | CodeBlockData,
  index: number,
  useFullCodeBlock: boolean,
  isStreamingBlock: boolean
): React.ReactNode | null => {
  // Use ReactNode type
  if (typeof item === "string") {
    // Ensure empty strings don't create empty divs if not desired
    if (!item.trim()) return null;
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

    if (useFullCodeBlock) {
      // Pass isStreaming prop to CodeBlockRenderer
      return (
        <CodeBlockRenderer
          key={`code-${index}`}
          lang={codeData.lang}
          code={codeData.code}
          isStreaming={isStreamingBlock} // Only the last block is actively streaming
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
          </div>
          <code
            className={cn(
              languageClass,
              "block p-4 font-mono text-sm leading-relaxed"
            )}
          >
            {codeData.code}
          </code>
        </pre>
      );
    }
  }
  return null;
};

export const StreamingContentView: React.FC<StreamingContentViewProps> = ({
  markdownContent,
  isStreaming = false,
  className,
}) => {
  const { enableStreamingMarkdown, enableStreamingCodeBlockParsing } =
    useSettingsStore(
      useShallow((state) => ({
        enableStreamingMarkdown: state.enableStreamingMarkdown,
        enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
      }))
    );

  // Call useMarkdownParser at the top level
  const parsedContent = useMarkdownParser(
    enableStreamingMarkdown ? markdownContent : null
  );

  // State to store the rendered elements of finalized blocks
  const [finalizedElements, setFinalizedElements] = useState<React.ReactNode[]>(
    []
  );
  // State to store the *data* of the currently streaming block
  const [streamingBlockData, setStreamingBlockData] = useState<
    string | CodeBlockData | null
  >(null);
  // Ref to track the number of finalized blocks rendered
  const finalizedBlockCountRef = useRef(0);

  // Effect to process markdown and update finalized/streaming blocks
  useEffect(() => {
    // If markdown streaming is off, handle raw content display
    if (!enableStreamingMarkdown) {
      setFinalizedElements([]);
      setStreamingBlockData(markdownContent ?? null);
      finalizedBlockCountRef.current = 0;
      return;
    }

    // Use the parsedContent from the hook call above
    const currentFinalizedCount = finalizedBlockCountRef.current;

    // Identify new blocks that have been finalized (all except the last one)
    const newlyFinalizedBlocks = parsedContent.slice(
      currentFinalizedCount,
      parsedContent.length - 1
    );

    if (newlyFinalizedBlocks.length > 0) {
      const newElements = newlyFinalizedBlocks
        .map((block, index) =>
          renderBlock(
            block,
            currentFinalizedCount + index,
            enableStreamingCodeBlockParsing,
            false
          )
        )
        .filter((el): el is React.ReactNode => el !== null);

      // Append new finalized elements
      setFinalizedElements((prev) => [...prev, ...newElements]);
      finalizedBlockCountRef.current += newlyFinalizedBlocks.length;
    }

    // Update the streaming block data (always the last block)
    const lastBlock =
      parsedContent.length > 0 ? parsedContent[parsedContent.length - 1] : null;

    // Only update if the data actually changed
    if (JSON.stringify(lastBlock) !== JSON.stringify(streamingBlockData)) {
      setStreamingBlockData(lastBlock);
    }

    // Reset if content becomes empty or null/undefined
    if (!markdownContent) {
      setFinalizedElements([]);
      setStreamingBlockData(null);
      finalizedBlockCountRef.current = 0;
    }
  }, [
    parsedContent,
    enableStreamingMarkdown,
    enableStreamingCodeBlockParsing,
    streamingBlockData,
    markdownContent,
  ]);

  // Render the streaming block separately using useMemo
  const streamingElement = useMemo(() => {
    if (!streamingBlockData || !enableStreamingMarkdown) return null;
    // Render the last block, indicating it's the one actively streaming
    return renderBlock(
      streamingBlockData,
      finalizedBlockCountRef.current,
      enableStreamingCodeBlockParsing,
      true
    );
  }, [
    streamingBlockData,
    enableStreamingCodeBlockParsing,
    enableStreamingMarkdown,
  ]);

  // Fallback for empty content
  if (!markdownContent?.trim() && finalizedElements.length === 0) {
    return (
      <div className={cn("text-muted-foreground italic", className)}>
        {isStreaming ? "Generating response..." : "No response content."}
      </div>
    );
  }

  // If markdown streaming is disabled, render raw text directly from markdownContent
  if (!enableStreamingMarkdown) {
    return (
      <pre className={cn("whitespace-pre-wrap text-sm", className)}>
        {markdownContent}
      </pre>
    );
  }

  // Render finalized elements + the separately rendered streaming element
  return (
    <div className={cn(className)}>
      {finalizedElements}
      {streamingElement}
    </div>
  );
};
