// src/components/lite-chat/code-block.tsx
import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import hljs from "highlight.js";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CodeBlockProps {
  /** The code content as a string */
  code: string;
  /** Optional language hint (e.g., 'javascript', 'python') */
  language?: string;
  /** Optional additional CSS classes for the container */
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(
  ({ code, language, className }) => {
    const codeContent = String(code || "").trim(); // Ensure it's a string and trim

    const highlightedHtml = useMemo(() => {
      try {
        if (language && hljs.getLanguage(language)) {
          return hljs.highlight(codeContent, {
            language: language,
            ignoreIllegals: true,
          }).value;
        }
        // Fallback to auto-detection if language is not provided or invalid
        return hljs.highlightAuto(codeContent).value;
      } catch (error) {
        console.error("Highlighting failed:", error);
        // Fallback to plain text if highlighting fails
        return codeContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
    }, [codeContent, language]);

    const handleCopy = () => {
      navigator.clipboard.writeText(codeContent);
      toast.success("Code copied to clipboard");
    };

    const displayLanguage = language || "code";

    return (
      // Use the dedicated container class for styling
      <div className={cn("code-block-container", className)}>
        {/* Header with language and copy button */}
        <div className="code-block-header">
          <span className="text-xs font-semibold text-muted-foreground select-none">
            {displayLanguage}
          </span>
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

        {/* Rendered HTML from highlight.js */}
        {/* Apply hljs class for theme compatibility */}
        <pre className="code-block-content m-0 p-0 border-0 bg-transparent">
          <code
            className={cn("hljs", language ? `language-${language}` : "")}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    );
  },
);
CodeBlock.displayName = "CodeBlock";
