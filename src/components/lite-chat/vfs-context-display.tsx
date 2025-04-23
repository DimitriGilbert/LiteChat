
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  CodeIcon,
  FileJson2Icon,
} from "lucide-react";

interface VfsContextDisplayProps {
  paths?: string[];
  className?: string;
}

const getFileIcon = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase();

  if (!extension) return <FileIcon className="h-4 w-4" />;

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return <ImageIcon className="h-4 w-4 text-blue-400" />;
  }

  // Code files
  if (
    [
      "js",
      "ts",
      "jsx",
      "tsx",
      "py",
      "java",
      "c",
      "cpp",
      "cs",
      "go",
      "rs",
      "php",
      "rb",
    ].includes(extension)
  ) {
    return <CodeIcon className="h-4 w-4 text-purple-400" />;
  }

  // JSON & config files
  if (["json", "yaml", "yml", "toml", "xml", "config"].includes(extension)) {
    return <FileJson2Icon className="h-4 w-4 text-yellow-400" />;
  }

  // Default text files
  return <FileTextIcon className="h-4 w-4 text-gray-400" />;
};

export const VfsContextDisplay: React.FC<VfsContextDisplayProps> = ({
  paths,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!paths || paths.length === 0) return null;

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <div className={cn("mt-2 mb-1", className)}>
      <div
        className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/40 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-800/60 transition-colors"
        onClick={toggleExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="font-medium">
          {paths.length} file{paths.length !== 1 ? "s" : ""} included
        </span>
      </div>

      {isExpanded && (
        <div className="pl-5 mt-1.5 border-l border-gray-700 ml-1.5 space-y-1.5">
          {paths.map((path) => (
            <div
              key={path}
              className="flex items-center gap-2 text-xs text-gray-300 hover:text-gray-100 transition-colors"
            >
              {getFileIcon(path)}
              <span className="font-mono truncate">{path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
