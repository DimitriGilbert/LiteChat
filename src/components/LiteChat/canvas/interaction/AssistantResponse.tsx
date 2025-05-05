// src/components/LiteChat/canvas/interaction/AssistantResponse.tsx

import React, { useState, useCallback } from "react";
import { ChevronDownIcon, ChevronUpIcon, BrainCircuitIcon } from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import {
  useMarkdownParser,
  CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { ToolCallPart, ToolResultPart } from "ai";
import { ToolCallDisplay } from "@/components/LiteChat/canvas/tool/CallDisplay";
import { ToolResultDisplay } from "@/components/LiteChat/canvas/tool/ResultDisplay";

// Component to render static markdown content (moved from InteractionCard)
const StaticContentView: React.FC<{ markdownContent: string | null }> = ({
  markdownContent,
}) => {
  const parsedContent = useMarkdownParser(markdownContent);

  if (!markdownContent?.trim()) {
    return null;
  }

  return (
    // Add overflow-wrap here for the main text content
    <div className="overflow-wrap-anywhere">
      {parsedContent.map((item, index) => {
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
          return (
            <CodeBlockRenderer
              key={`code-${index}`}
              lang={codeData.lang}
              code={codeData.code}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

interface AssistantResponseProps {
  response: any | null;
  toolCalls: string[] | undefined;
  toolResults: string[] | undefined;
  reasoning: string | undefined;
  isError: boolean;
  errorMessage: string | undefined;
  isFolded: boolean;
  toggleFold: () => void;
}

export const AssistantResponse: React.FC<AssistantResponseProps> = ({
  response,
  toolCalls,
  toolResults,
  reasoning,
  isError,
  errorMessage,
  isFolded,
  toggleFold,
}) => {
  const [isReasoningFolded, setIsReasoningFolded] = useState(true);
  const toggleReasoningFold = useCallback(
    () => setIsReasoningFolded((prev) => !prev),
    [],
  );

  const hasReasoning = !!reasoning;
  const hasResponseContent =
    response && (typeof response !== "string" || response.trim().length > 0);
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasToolResults = toolResults && toolResults.length > 0;

  if (isFolded) {
    return (
      <div
        className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
        onClick={toggleFold}
      >
        {hasReasoning ? "[Reasoning] " : ""}
        {hasToolCalls ? `[${toolCalls?.length} Tool Call(s)] ` : ""}
        {hasResponseContent && typeof response === "string"
          ? `"${response.substring(0, 80)}${response.length > 80 ? "..." : ""}"`
          : hasToolCalls || hasToolResults || hasReasoning
            ? ""
            : "[No text response]"}
      </div>
    );
  }

  return (
    <>
      {isError && errorMessage && (
        <div className="mb-2 rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive-foreground">
          <p className="font-semibold">Error:</p>
          <p>{errorMessage}</p>
        </div>
      )}
      {/* Reasoning Display */}
      {hasReasoning && (
        <div className="my-2 p-2 border border-blue-500/30 bg-blue-500/10 rounded-md text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <BrainCircuitIcon className="h-3.5 w-3.5" /> Reasoning
            </span>
            <ActionTooltipButton
              tooltipText={
                isReasoningFolded ? "Show Reasoning" : "Hide Reasoning"
              }
              onClick={toggleReasoningFold}
              aria-label={
                isReasoningFolded ? "Show reasoning" : "Hide reasoning"
              }
              icon={isReasoningFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
              iconClassName="h-3 w-3"
              className="h-5 w-5 text-muted-foreground"
            />
          </div>
          {!isReasoningFolded && (
            // Add overflow-wrap to pre tag for reasoning
            <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-background/30 rounded mt-1 overflow-wrap-anywhere">
              {reasoning!}
            </pre>
          )}
        </div>
      )}
      {/* Render Tool Calls */}
      {toolCalls?.map((callStr, idx) => {
        try {
          const parsedCall = JSON.parse(callStr) as ToolCallPart;
          return <ToolCallDisplay key={`call-${idx}`} toolCall={parsedCall} />;
        } catch (e) {
          console.error("Failed to parse tool call string:", e);
          return (
            <div key={`call-err-${idx}`} className="text-xs text-destructive">
              [Error displaying tool call]
            </div>
          );
        }
      })}
      {/* Render Tool Results */}
      {toolResults?.map((resStr, idx) => {
        try {
          const parsedResult = JSON.parse(resStr) as ToolResultPart;
          return (
            <ToolResultDisplay key={`res-${idx}`} toolResult={parsedResult} />
          );
        } catch (e) {
          console.error("Failed to parse tool result string:", e);
          return (
            <div key={`res-err-${idx}`} className="text-xs text-destructive">
              [Error displaying tool result]
            </div>
          );
        }
      })}
      {/* Render Text Response */}
      <StaticContentView markdownContent={response} />
      {/* Show placeholder if no text and no tools */}
      {!hasResponseContent &&
        !hasToolCalls &&
        !hasToolResults &&
        !hasReasoning && (
          <div className="text-muted-foreground italic">
            No response content.
          </div>
        )}
    </>
  );
};
