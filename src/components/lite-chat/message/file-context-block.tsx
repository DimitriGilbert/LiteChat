// src/components/lite-chat/message/file-context-block.tsx
import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  PaperclipIcon,
  FolderIcon,
} from "lucide-react";
import hljs from "highlight.js";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Remarkable } from "remarkable";

interface FileContextBlockProps {
  type: "vfs" | "attached";
  pathOrName: string;
  content: string | null;
  extension: string;
  error?: string;
  status?: string;
  className?: string;
}

export const FileContextBlock: React.FC<FileContextBlockProps> = ({
  type,
  pathOrName,
  content,
  extension,
  error,
  status,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const displayPath = type === "vfs" ? pathOrName : "";
  const displayName =
    type === "attached"
      ? pathOrName
      : pathOrName.split("/").pop() || pathOrName;
  const Icon = type === "vfs" ? FolderIcon : PaperclipIcon;

  const hasContent =
    content !== null && content !== undefined && !error && !status;

  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success("File content copied to clipboard");
    }
  }, [content]);

  const highlightedContentHtml = React.useMemo(() => {
    if (!hasContent || !content) return "";
    try {
      if (extension && hljs.getLanguage(extension)) {
        return hljs.highlight(content, {
          language: extension,
          ignoreIllegals: true,
        }).value;
      }
      return hljs.highlightAuto(content).value;
    } catch (e) {
      console.error("Highlighting failed for file context:", e);
      return Remarkable.utils.escapeHtml(content);
    }
  }, [content, extension, hasContent]);

  return (
    // Use the specific container class
    <div className={cn("file-context-block-container", className)}>
      {/* Header */}
      <div
        // Use the specific header class
        className={cn(
          "file-context-block-header",
          hasContent && "cursor-pointer hover:bg-muted/80 transition-colors",
        )}
        onClick={hasContent ? toggleExpanded : undefined}
        role={hasContent ? "button" : undefined}
        aria-expanded={isExpanded}
      >
        {hasContent ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 flex-shrink-0"></div> // Placeholder
        )}
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">
          {displayName}
        </span>
        {displayPath && (
          <span className="text-xs text-muted-foreground ml-1 truncate hidden sm:inline">
            ({displayPath})
          </span>
        )}
        {error && (
          <span className="text-xs text-red-400 ml-auto font-medium">
            Error: {error}
          </span>
        )}
        {status && (
          <span className="text-xs text-yellow-400 ml-auto font-medium">
            {status}
          </span>
        )}
        {/* Copy Button in Header */}
        {hasContent && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Use the button styling from CSS */}
                <button
                  className="copy-button ml-auto" // Use the copy-button class
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  aria-label="Copy file content"
                  title="Copy file content"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Copy content</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Content Area */}
      {isExpanded && hasContent && (
        // Use the specific content class
        <div className="file-context-block-content">
          <pre>
            <code
              className={cn("hljs", extension ? `language-${extension}` : "")}
              dangerouslySetInnerHTML={{ __html: highlightedContentHtml }}
            />
          </pre>
        </div>
      )}
    </div>
  );
};
