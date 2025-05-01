import React, { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { ToolResultPart } from "ai"; // Import AI SDK types

export const ToolResultDisplay: React.FC<{ toolResult: ToolResultPart }> = ({
  toolResult,
}) => {
  const [isResultFolded, setIsResultFolded] = useState(true); // Default unfolded
  const toggleFold = () => setIsResultFolded((p) => !p);
  const resultString = useMemo(() => {
    try {
      // Check for structured error from AIService wrapper
      if (
        typeof toolResult.result === "object" &&
        toolResult.result !== null &&
        (toolResult.result as any)._isError === true
      ) {
        return `Error: ${(toolResult.result as any).error}`;
      }
      return JSON.stringify(toolResult.result, null, 2);
    } catch {
      return String(toolResult.result);
    }
  }, [toolResult.result]);

  const isErrorResult =
    typeof toolResult.result === "object" &&
    toolResult.result !== null &&
    (toolResult.result as any)._isError === true;

  return (
    <div
      className={cn(
        "my-2 p-2 border rounded-md text-xs",
        isErrorResult
          ? "border-destructive/30 bg-destructive/10"
          : "border-green-500/30 bg-green-500/10",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "font-semibold",
            isErrorResult
              ? "text-destructive"
              : "text-green-700 dark:text-green-300",
          )}
        >
          Tool Result: <code className="font-mono">{toolResult.toolName}</code>
        </span>
        <ActionTooltipButton
          tooltipText={isResultFolded ? "Show Result" : "Hide Result"}
          onClick={toggleFold}
          aria-label={isResultFolded ? "Show result" : "Hide result"}
          icon={isResultFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
          iconClassName="h-3 w-3"
          className="h-5 w-5 text-muted-foreground"
        />
      </div>
      {!isResultFolded && (
        <CodeBlockRenderer
          lang={isErrorResult ? "text" : "json"}
          code={resultString}
        />
      )}
    </div>
  );
};
