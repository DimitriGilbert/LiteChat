// src/components/LiteChat/canvas/InteractionCard.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react"; // Added useEffect
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CheckIcon,
  ChevronsUpDownIcon, // Icon for fold/unfold
  CopyIcon, // Added CopyIcon
  WrenchIcon, // Icon for tool calls
  CheckCircle2Icon, // Icon for tool results
  Loader2, // Icon for tool in progress
  ChevronDown, // Icon for folding tool display
  ChevronRight, // Icon for unfolding tool display
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useMarkdownParser,
  type ParsedContent,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { memo } from "react";
import { toast } from "sonner"; // For copy feedback
import type { ToolCallPart, ToolResultPart } from "ai"; // Import AI SDK types for parsing

interface InteractionCardProps {
  interaction: Interaction;
  allInteractionsInGroup: Interaction[];
  onRegenerate?: (id: string) => void;
  className?: string;
}

// Helper to render tool calls/results (Parses strings)
const ToolDisplay: React.FC<{
  toolCallStrings?: string[];
  toolResultStrings?: string[];
}> = ({ toolCallStrings, toolResultStrings }) => {
  // State for folding individual tool calls
  const [foldedToolCalls, setFoldedToolCalls] = useState<Set<string>>(
    new Set(),
  );
  const [parsedCalls, setParsedCalls] = useState<ToolCallPart[]>([]);
  const [parsedResults, setParsedResults] = useState<ToolResultPart[]>([]);
  const [resultsMap, setResultsMap] = useState<Map<string, ToolResultPart>>(
    new Map(),
  );

  // Effect to parse and initialize fold state only when strings change
  useEffect(() => {
    const calls: ToolCallPart[] = [];
    const results: ToolResultPart[] = [];
    const initialFolded = new Set<string>();

    (toolCallStrings ?? []).forEach((callStr) => {
      try {
        const parsed = JSON.parse(callStr);
        if (
          parsed &&
          parsed.type === "tool-call" &&
          parsed.toolCallId &&
          parsed.toolName &&
          parsed.args !== undefined
        ) {
          calls.push(parsed as ToolCallPart);
          initialFolded.add(parsed.toolCallId); // Initialize as folded
        } else {
          console.warn("Skipping invalid tool call string:", callStr);
        }
      } catch (e) {
        console.error(
          "Failed to parse tool call string for display:",
          callStr,
          e,
        );
      }
    });

    (toolResultStrings ?? []).forEach((resultStr) => {
      try {
        const parsed = JSON.parse(resultStr);
        if (
          parsed &&
          parsed.type === "tool-result" &&
          parsed.toolCallId &&
          parsed.toolName &&
          parsed.result !== undefined
        ) {
          results.push(parsed as ToolResultPart);
        } else {
          console.warn("Skipping invalid tool result string:", resultStr);
        }
      } catch (e) {
        console.error(
          "Failed to parse tool result string for display:",
          resultStr,
          e,
        );
      }
    });

    setParsedCalls(calls);
    setParsedResults(results);
    setResultsMap(new Map(results.map((r) => [r.toolCallId, r])));
    setFoldedToolCalls(initialFolded);
    // Depend only on the input strings
  }, [toolCallStrings, toolResultStrings]);

  const toggleToolCallFold = (toolCallId: string) => {
    setFoldedToolCalls((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  };

  if (parsedCalls.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
      {/* Tool Display Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <WrenchIcon className="h-3.5 w-3.5" />
          <span>Tool Activity ({parsedCalls.length} calls)</span>
        </div>
        {/* Optional: Add button to fold/unfold ALL tool calls */}
      </div>

      {/* Render individual tool calls */}
      {parsedCalls.map((call, index) => {
        const isFolded = foldedToolCalls.has(call.toolCallId);
        const result = resultsMap.get(call.toolCallId);
        const isErrorResult =
          result &&
          typeof result.result === "object" &&
          result.result !== null &&
          (result.result as any)._isError === true;
        const errorText = isErrorResult
          ? String((result!.result as any).error)
          : null;
        const status = result
          ? isErrorResult
            ? "error"
            : "completed"
          : "pending";
        const resultDisplay = result
          ? isErrorResult
            ? `Error: ${errorText}`
            : JSON.stringify(result.result, null, 2)
          : "Waiting for result...";

        return (
          <div
            key={call.toolCallId}
            className="p-2 border rounded bg-muted/30 text-xs"
          >
            {/* Tool Call Header with Fold Button */}
            <div className="flex items-center justify-between gap-1.5 font-medium mb-1">
              <div className="flex items-center gap-1.5">
                {status === "pending" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                )}
                {status === "completed" && (
                  <CheckCircle2Icon className="h-3.5 w-3.5 text-green-500" />
                )}
                {status === "error" && (
                  <AlertCircleIcon className="h-3.5 w-3.5 text-destructive" />
                )}
                <WrenchIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  Tool Call #{index + 1}: {call.toolName}
                </span>
              </div>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleToolCallFold(call.toolCallId)}
                      aria-label={
                        isFolded ? "Expand tool call" : "Collapse tool call"
                      }
                    >
                      {isFolded ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isFolded ? "Expand" : "Collapse"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Conditionally render details */}
            {!isFolded && (
              <div className="pl-5 space-y-1 mt-1">
                <div>
                  <span className="font-semibold">Args:</span>
                  <pre className="text-[11px] bg-background/50 p-1 rounded mt-0.5 whitespace-pre-wrap break-words">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="font-semibold">Result:</span>
                  <pre
                    className={cn(
                      "text-[11px] p-1 rounded mt-0.5 whitespace-pre-wrap break-words",
                      isErrorResult
                        ? "bg-destructive/10 text-destructive"
                        : "bg-background/50",
                    )}
                  >
                    {resultDisplay}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const InteractionCardComponent: React.FC<InteractionCardProps> = ({
  interaction,
  allInteractionsInGroup,
  onRegenerate,
  className,
}) => {
  const [revisionIndex, setRevisionIndex] = useState(0);
  const [isFolded, setIsFolded] = useState(false); // State for folding main content
  const [isCopied, setIsCopied] = useState(false); // State for copy button
  const [isIdCopied, setIsIdCopied] = useState(false); // State for copy ID button

  const revisions = useMemo(() => {
    return allInteractionsInGroup
      .filter(
        (i) =>
          i.type === "message.user_assistant" &&
          i.status === "COMPLETED" &&
          i.prompt === null, // Filter only assistant responses for revisions
      )
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      );
  }, [allInteractionsInGroup]);

  // Ensure displayedInteraction is always an assistant response if revisions exist
  const displayedInteraction =
    revisions.length > 0 ? revisions[revisionIndex] : interaction;

  const responseText =
    typeof displayedInteraction.response === "string"
      ? displayedInteraction.response
      : null;

  const parsedContent: ParsedContent = useMarkdownParser(responseText);

  // Can only regenerate if the *original* interaction had a prompt
  const canRegenerate =
    interaction.prompt && // Check original interaction for prompt
    displayedInteraction.status === "COMPLETED" &&
    typeof onRegenerate === "function" &&
    revisionIndex === 0; // Only allow regenerating from the latest revision

  const handleRegenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use the ID of the original interaction that had the prompt
    if (onRegenerate && interaction.prompt) {
      onRegenerate(interaction.id);
    } else {
      console.error(
        "Could not regenerate: No callback or prompt data found in the original interaction.",
        interaction,
      );
    }
  };

  const handleRevisionChange = (direction: "prev" | "next") => {
    setRevisionIndex((prev) => {
      if (direction === "prev") {
        return Math.min(prev + 1, revisions.length - 1);
      } else {
        return Math.max(prev - 1, 0);
      }
    });
  };

  const handleCopy = useCallback(async () => {
    if (!responseText) return;
    try {
      await navigator.clipboard.writeText(responseText);
      setIsCopied(true);
      toast.success("Response copied to clipboard!");
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy response.");
      console.error("Clipboard copy failed:", err);
    }
  }, [responseText]);

  // Callback to copy the interaction ID
  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayedInteraction.id);
      setIsIdCopied(true);
      toast.success("Interaction ID copied to clipboard!");
      setTimeout(() => setIsIdCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy interaction ID.");
      console.error("Clipboard copy failed:", err);
    }
  }, [displayedInteraction.id]);

  const toggleFold = () => setIsFolded((prev) => !prev);

  const hasRevisions = revisions.length > 1;
  const canGoPrevRevision = revisionIndex < revisions.length - 1;
  const canGoNextRevision = revisionIndex > 0;

  // Get first few lines for folded preview
  const foldedPreviewText = useMemo(() => {
    if (!responseText) return "";
    return responseText
      .split(
        `
`,
      )
      .slice(0, 3).join(`
`);
  }, [responseText]);

  // Calculate generation time
  const generationTime = useMemo(() => {
    if (displayedInteraction.startedAt && displayedInteraction.endedAt) {
      const diff =
        displayedInteraction.endedAt.getTime() -
        displayedInteraction.startedAt.getTime();
      return (diff / 1000).toFixed(2); // Time in seconds
    }
    return null;
  }, [displayedInteraction.startedAt, displayedInteraction.endedAt]);

  const hasToolActivity =
    (displayedInteraction.metadata?.toolCalls?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        // Add group class here
        "p-3 my-2 border rounded-md shadow-sm bg-card relative group",
        className,
      )}
    >
      {/* Header */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Assistant | {displayedInteraction.status}
          {displayedInteraction.metadata?.modelId && (
            <span className="ml-2 text-blue-400">
              ({displayedInteraction.metadata.modelId})
            </span>
          )}
        </span>
        {/* Action Buttons Container - Use the sticky class */}
        <div className="interaction-card-actions-sticky">
          {/* Fold/Unfold Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold response" : "Fold response"}
                >
                  <ChevronsUpDownIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFolded ? "Unfold" : "Fold"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Revision Navigation */}
          {hasRevisions && (
            <div className="flex items-center border border-border rounded bg-background/50">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRevisionChange("prev")}
                      disabled={!canGoPrevRevision}
                      aria-label="Previous revision"
                    >
                      <ChevronLeftIcon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Previous Revision</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-[10px] px-1 text-muted-foreground select-none">
                {revisionIndex + 1}/{revisions.length}
              </span>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRevisionChange("next")}
                      disabled={!canGoNextRevision}
                      aria-label="Next revision"
                    >
                      <ChevronRightIcon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Next Revision</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Copy ID Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyId}
                  aria-label="Copy interaction ID"
                >
                  {isIdCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy ID</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Copy Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  aria-label="Copy response"
                  disabled={!responseText}
                >
                  {isCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Regenerate Button */}
          {canRegenerate && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleRegenerateClick}
                    aria-label="Regenerate response"
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Regenerate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="text-sm markdown-content">
        {isFolded ? (
          // Folded Preview
          <div
            className="folded-content-preview cursor-pointer"
            onClick={toggleFold}
          >
            {/* Render first few lines as plain text or simple markdown */}
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">
              {foldedPreviewText || (hasToolActivity ? "[Tool Activity]" : "")}
            </pre>
          </div>
        ) : (
          // Full Content
          <>
            {parsedContent.map((part, index) => {
              if (typeof part === "string") {
                return (
                  <div key={index} dangerouslySetInnerHTML={{ __html: part }} />
                );
              } else if (part.type === "code") {
                return (
                  <CodeBlockRenderer
                    key={index}
                    lang={part.lang}
                    code={part.code}
                  />
                );
              }
              return null;
            })}
            {/* Render Tool Calls/Results if they exist (pass string arrays) */}
            <ToolDisplay
              toolCallStrings={displayedInteraction.metadata?.toolCalls}
              toolResultStrings={displayedInteraction.metadata?.toolResults}
            />
          </>
        )}
      </div>

      {/* Footer for Metadata */}
      {!isFolded &&
        (displayedInteraction.metadata?.promptTokens ||
          displayedInteraction.metadata?.completionTokens ||
          generationTime) && (
          // Change justify-end to justify-start
          <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex justify-start gap-3">
            {generationTime && <span>Time: {generationTime}s</span>}
            {(displayedInteraction.metadata?.promptTokens ||
              displayedInteraction.metadata?.completionTokens) && (
              <span>
                Tokens: {displayedInteraction.metadata?.promptTokens ?? "?"}{" "}
                (in) / {displayedInteraction.metadata?.completionTokens ?? "?"}{" "}
                (out)
              </span>
            )}
          </div>
        )}

      {/* Error Display */}
      {displayedInteraction.status === "ERROR" &&
        displayedInteraction.metadata?.error && (
          <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <AlertCircleIcon className="h-3.5 w-3.5" />
            <span>Error: {displayedInteraction.metadata.error}</span>
          </div>
        )}
      {/* Warning Display */}
      {displayedInteraction.status === "WARNING" &&
        displayedInteraction.metadata?.error && (
          <div className="mt-2 flex items-center gap-1 text-xs text-accent">
            <AlertCircleIcon className="h-3.5 w-3.5" />
            <span>Error: {displayedInteraction.metadata.error}</span>
          </div>
        )}
    </div>
  );
};

export const InteractionCard = memo(InteractionCardComponent);
