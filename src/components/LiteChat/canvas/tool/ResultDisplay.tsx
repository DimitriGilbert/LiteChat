import React, { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { UniversalBlockRenderer } from "@/components/LiteChat/common/UniversalBlockRenderer";
import { ToolResultPart } from "ai"

export const ToolResultDisplay: React.FC<{ toolResult: ToolResultPart }> = ({
  toolResult,
}) => {
  const [isResultFolded, setIsResultFolded] = useState(true)
  const toggleFold = () => setIsResultFolded((p) => !p);
  const resultString = useMemo(() => {
    try {
      // Check for structured error from AIService wrapper
      if (
        typeof toolResult.output === "object" &&
        toolResult.output !== null &&
        (toolResult.output as any)._isError === true
      ) {
        return `Error: ${(toolResult.output as any).error}`;
      }
      return JSON.stringify(toolResult.output, null, 2);
    } catch {
      return String(toolResult.output);
    }
  }, [toolResult.output]);

  const isErrorResult =
    typeof toolResult.output === "object" &&
    toolResult.output !== null &&
    (toolResult.output as any)._isError === true;

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
        <UniversalBlockRenderer
          lang={isErrorResult ? "text" : "json"}
          code={resultString}
        />
      )}
    </div>
  );
};
