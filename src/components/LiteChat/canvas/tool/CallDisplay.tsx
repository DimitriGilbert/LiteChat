import React, { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { ToolCallPart } from "ai"

export const ToolCallDisplay: React.FC<{ toolCall: ToolCallPart }> = ({
  toolCall,
}) => {
  const [isArgsFolded, setIsArgsFolded] = useState(true);
  const toggleFold = () => setIsArgsFolded((p) => !p);
  const argsString = useMemo(() => {
    try {
      return JSON.stringify(toolCall.args, null, 2);
    } catch {
      return String(toolCall.args);
    }
  }, [toolCall.args]);

  return (
    <div className="my-2 p-2 border border-amber-500/30 bg-amber-500/10 rounded-md text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-amber-700 dark:text-amber-300">
          Tool Call: <code className="font-mono">{toolCall.toolName}</code>
        </span>
        <ActionTooltipButton
          tooltipText={isArgsFolded ? "Show Args" : "Hide Args"}
          onClick={toggleFold}
          aria-label={isArgsFolded ? "Show arguments" : "Hide arguments"}
          icon={isArgsFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
          iconClassName="h-3 w-3"
          className="h-5 w-5 text-muted-foreground"
        />
      </div>
      {!isArgsFolded && <CodeBlockRenderer lang="json" code={argsString} />}
    </div>
  );
};
