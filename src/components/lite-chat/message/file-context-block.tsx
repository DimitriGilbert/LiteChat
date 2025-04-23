
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  PaperclipIcon,
  FolderIcon,
} from "lucide-react";
import { CodeBlock } from "@/components/lite-chat/code-block"; // Corrected import path if needed

interface FileContextBlockProps {
  type: "vfs" | "attached";
  pathOrName: string; // VFS path or attached file name
  content: string | null; // Content can be null if there was an error or skipped
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
  const [isExpanded, setIsExpanded] = useState(false); // Default to collapsed

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const displayPath = type === "vfs" ? pathOrName : "";
  const displayName =
    type === "attached"
      ? pathOrName
      : pathOrName.split("/").pop() || pathOrName;
  const Icon = type === "vfs" ? FolderIcon : PaperclipIcon;

  const hasContent =
    content !== null && content !== undefined && !error && !status;

  return (
    <div
      className={cn(
        "my-3 border border-gray-700/70 rounded-md overflow-hidden bg-gray-900/30",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 p-2 bg-gray-800/60",
          hasContent && "cursor-pointer hover:bg-gray-800/90 transition-colors",
        )}
        onClick={hasContent ? toggleExpanded : undefined}
        role={hasContent ? "button" : undefined}
        aria-expanded={isExpanded}
      >
        {hasContent ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 flex-shrink-0"></div> // Placeholder for alignment
        )}
        <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-300 truncate">
          {displayName}
        </span>
        {displayPath && (
          <span className="text-xs text-gray-500 ml-auto truncate hidden sm:inline">
            {displayPath}
          </span>
        )}
        {error && (
          <span className="text-xs text-red-400 ml-2 font-medium">Error</span>
        )}
        {status && (
          <span className="text-xs text-yellow-400 ml-2 font-medium">
            {status}
          </span>
        )}
      </div>

      {isExpanded && hasContent && (
        <div className="text-sm border-t border-gray-700/70">
          <div className="bg-gray-900 text-gray-100 rounded-b-md overflow-x-auto">
            {/* Pass content as children, not value */}
            <CodeBlock
              className={extension ? `language-${extension}` : "language-text"}
            >
              {typeof content === "string" ? content : ""}
            </CodeBlock>
          </div>
        </div>
      )}
    </div>
  );
};
