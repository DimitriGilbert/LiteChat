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
  const codeContent = String(children).replace(/\\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    toast.success("Code copied to clipboard");
  };

  if (inline) {
    return (
      <code
        className={cn(
          "font-mono text-sm px-1 py-0.5 rounded-sm bg-gray-700",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative group/codeblock my-3 rounded-md border border-gray-700/50 bg-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-700/30 dark:bg-gray-800/40 border-b border-gray-700/50">
        <span className="text-xs font-semibold text-gray-400 select-none">
          {language}
        </span>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
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
                  className="h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
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
          // Add overflow-x-auto class to the PreTag element
          className={cn(
            "!py-3 !px-0 !m-0 !bg-transparent",
            "overflow-x-auto", // Enable horizontal scrolling
          )}
          codeTagProps={{
            style: {
              fontFamily: "var(--font-mono)",
              fontSize: "0.875rem",
              lineHeight: "1.25rem",
              display: "block",
              paddingLeft: "1rem",
              paddingRight: "1rem",
              // Ensure code doesn't wrap unexpectedly
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
            // Make line numbers sticky to the left during horizontal scroll
            position: "sticky",
            left: 0,
            background: "inherit", // Match background
            zIndex: 1, // Ensure it's above the code lines
          }}
          wrapLines={false} // Explicitly disable line wrapping in the highlighter
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      )}
    </div>
  );
});
CodeBlock.displayName = "CodeBlock";
