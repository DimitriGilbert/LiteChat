// src/components/lite-chat/code-block.tsx
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = React.memo(({ inline, className, children, ...props }) => {
  const [isFolded, setIsFolded] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";
  const codeContent = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    toast.success("Code copied to clipboard");
  };

  if (inline) {
    return (
      <code
        className={cn(
          "font-mono text-sm px-1 py-0.5 rounded-sm bg-muted",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative group/codeblock my-3 rounded-md border border-border bg-card dark:bg-card transition-all">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 dark:bg-muted/40 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground select-none">
          {language}
        </span>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setIsFolded(!isFolded)}
                  aria-label={isFolded ? "Expand code" : "Collapse code"}
                >
                  {isFolded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isFolded ? "Expand code" : "Collapse code"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={handleCopy}
                  aria-label="Copy code"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Copy code</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {!isFolded && (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          className={cn("!py-3 !px-0 !m-0 !bg-transparent", "overflow-x-auto")}
          codeTagProps={{
            style: {
              fontFamily: "var(--font-mono)",
              fontSize: "0.875rem",
              lineHeight: "1.25rem",
              display: "block",
              paddingLeft: "1rem",
              paddingRight: "1rem",
              whiteSpace: "pre",
            },
          }}
          showLineNumbers
          lineNumberStyle={{
            minWidth: "2.25em",
            paddingRight: "1em",
            textAlign: "right",
            color: "#858585",
            userSelect: "none",
            position: "sticky",
            left: 0,
            background: "inherit",
            zIndex: 1,
          }}
          wrapLines={false}
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      )}
    </div>
  );
});
CodeBlock.displayName = "CodeBlock";
