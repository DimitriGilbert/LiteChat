// src/components/LiteChat/canvas/interaction/AssistantResponse.tsx
// FULL FILE
import React, { useState, useCallback } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  BrainCircuitIcon,
  ClipboardIcon,
  CheckIcon,
} from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import {
  useMarkdownParser,
  CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { ToolCallPart, ToolResultPart } from "ai";
import { ToolCallDisplay } from "@/components/LiteChat/canvas/tool/CallDisplay";
import { ToolResultDisplay } from "@/components/LiteChat/canvas/tool/ResultDisplay";
import { toast } from "sonner";

const StaticContentView: React.FC<{ markdownContent: string | null }> = ({
  markdownContent,
}) => {
  const parsedContent = useMarkdownParser(markdownContent);

  if (!markdownContent?.trim()) {
    return null;
  }

  return (
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
  const [isReasoningCopied, setIsReasoningCopied] = useState(false);

  const toggleReasoningFold = useCallback(
    () => setIsReasoningFolded((prev) => !prev),
    [],
  );

  const handleCopyReasoning = useCallback(async () => {
    if (!reasoning) return;
    try {
      await navigator.clipboard.writeText(reasoning);
      setIsReasoningCopied(true);
      toast.success("Reasoning copied!");
      setTimeout(() => setIsReasoningCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy reasoning.");
      console.error("Clipboard copy failed for reasoning:", err);
    }
  }, [reasoning]);

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
      {hasReasoning && (
        <div className="my-2 p-2 border border-blue-500/30 bg-blue-500/10 rounded-md text-xs">
          <div
            className="flex items-center justify-between mb-1 cursor-pointer group/reasoning"
            onClick={toggleReasoningFold}
          >
            <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <BrainCircuitIcon className="h-3.5 w-3.5" /> Reasoning
            </span>
            <div className="flex items-center opacity-0 group-hover/reasoning:opacity-100 focus-within:opacity-100 transition-opacity">
              <ActionTooltipButton
                tooltipText="Copy Reasoning"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyReasoning();
                }}
                aria-label="Copy reasoning"
                icon={
                  isReasoningCopied ? (
                    <CheckIcon className="text-green-500" />
                  ) : (
                    <ClipboardIcon />
                  )
                }
                className="h-5 w-5 text-muted-foreground"
              />
              <ActionTooltipButton
                tooltipText={
                  isReasoningFolded ? "Show Reasoning" : "Hide Reasoning"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  toggleReasoningFold();
                }}
                aria-label={
                  isReasoningFolded ? "Show reasoning" : "Hide reasoning"
                }
                icon={
                  isReasoningFolded ? <ChevronDownIcon /> : <ChevronUpIcon />
                }
                iconClassName="h-3 w-3"
                className="h-5 w-5 text-muted-foreground"
              />
            </div>
          </div>
          {!isReasoningFolded && (
            <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-background/30 rounded mt-1 overflow-wrap-anywhere">
              {reasoning!}
            </pre>
          )}
        </div>
      )}
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
      <StaticContentView markdownContent={response} />
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
