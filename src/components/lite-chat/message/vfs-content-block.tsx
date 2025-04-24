import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileTextIcon } from "lucide-react";
import { CodeBlock } from "@/components/lite-chat/code-block";

interface VfsContentBlockProps {
  path: string;
  content: string;
  extension: string;
  className?: string;
}

export const VfsContentBlock: React.FC<VfsContentBlockProps> = ({
  path,
  extension,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const filename = path.split("/").pop() || path;

  return (
    <div
      className={cn(
        "my-3 border border-gray-700/70 rounded-md overflow-hidden",
        className,
      )}
    >
      <div
        className="flex items-center gap-2 p-2 bg-gray-800/80 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={toggleExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
        <FileTextIcon className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">{filename}</span>
        <span className="text-xs text-gray-500 ml-auto">{path}</span>
      </div>

      {isExpanded && (
        <div className="text-sm">
          <div className="bg-gray-900 text-gray-100 rounded-b-md">
            <CodeBlock
              className={extension ? `language-${extension}` : "language-text"}
            />
          </div>
        </div>
      )}
    </div>
  );
};
