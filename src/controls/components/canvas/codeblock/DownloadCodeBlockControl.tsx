import React, { useCallback } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

interface DownloadCodeBlockControlProps {
  interactionId?: string;
  codeBlockId?: string;
  language?: string;
  codeToDownload: string;
  filepath?: string;
  disabled?: boolean;
}

export const DownloadCodeBlockControl: React.FC<DownloadCodeBlockControlProps> = ({
  interactionId,
  codeBlockId,
  language,
  codeToDownload,
  filepath,
  disabled,
}) => {
  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || !codeToDownload) return;

      try {
        // Determine filename
        let filename: string;
        if (filepath) {
          // Extract basename from filepath
          const pathParts = filepath.split('/');
          filename = pathParts[pathParts.length - 1];
        } else {
          // Generate filename based on language
          const extension = getFileExtension(language);
          filename = `code${extension}`;
        }

        // Create blob and download
        const blob = new Blob([codeToDownload], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        toast.success(`Downloaded ${filename}`);
      } catch (error) {
        console.error('Download failed:', error);
        toast.error('Failed to download file');
      }
    },
    [interactionId, codeBlockId, language, codeToDownload, filepath, disabled]
  );

  // Only show download button if there's a filepath or if the code is substantial
  const shouldShow = filepath || (codeToDownload && codeToDownload.trim().length > 5000);
  
  if (!shouldShow) {
    return null;
  }

  return (
    <ActionTooltipButton
      tooltipText="Download File"
      onClick={handleDownload}
      aria-label="Download code as file"
      disabled={disabled || !codeToDownload}
      icon={<DownloadIcon />}
      iconClassName="h-3.5 w-3.5"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
    />
  );
};

// Helper function to get file extension based on language
function getFileExtension(language?: string): string {
  if (!language) return '.txt';
  
  const extensionMap: Record<string, string> = {
    'javascript': '.js',
    'js': '.js',
    'typescript': '.ts',
    'ts': '.ts',
    'tsx': '.tsx',
    'jsx': '.jsx',
    'python': '.py',
    'py': '.py',
    'java': '.java',
    'c': '.c',
    'cpp': '.cpp',
    'cxx': '.cxx',
    'cc': '.cc',
    'c++': '.cpp',
    'csharp': '.cs',
    'cs': '.cs',
    'php': '.php',
    'ruby': '.rb',
    'rb': '.rb',
    'go': '.go',
    'rust': '.rs',
    'rs': '.rs',
    'swift': '.swift',
    'kotlin': '.kt',
    'kt': '.kt',
    'scala': '.scala',
    'html': '.html',
    'css': '.css',
    'scss': '.scss',
    'sass': '.sass',
    'less': '.less',
    'json': '.json',
    'xml': '.xml',
    'yaml': '.yaml',
    'yml': '.yml',
    'toml': '.toml',
    'ini': '.ini',
    'conf': '.conf',
    'config': '.config',
    'sh': '.sh',
    'bash': '.sh',
    'zsh': '.zsh',
    'fish': '.fish',
    'powershell': '.ps1',
    'ps1': '.ps1',
    'bat': '.bat',
    'cmd': '.cmd',
    'sql': '.sql',
    'r': '.r',
    'matlab': '.m',
    'octave': '.m',
    'lua': '.lua',
    'perl': '.pl',
    'vim': '.vim',
    'dockerfile': 'Dockerfile',
    'makefile': 'Makefile',
    'markdown': '.md',
    'md': '.md',
    'tex': '.tex',
    'latex': '.tex',
  };
  
  const ext = extensionMap[language.toLowerCase()];
  return ext || '.txt';
} 