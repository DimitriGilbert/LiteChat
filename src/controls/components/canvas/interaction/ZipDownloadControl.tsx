import React, { useCallback, useMemo } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ArchiveIcon } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { useMarkdownParser, UniversalBlockData } from "@/lib/litechat/useMarkdownParser";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { useTranslation } from "react-i18next";

interface ZipDownloadControlProps {
  context: CanvasControlRenderContext;
}

export const ZipDownloadControl: React.FC<ZipDownloadControlProps> = ({
  context,
}) => {
  const { t } = useTranslation('canvas');
  // Parse the response content to extract code blocks
  const parsedContent = useMarkdownParser(context.responseContent || "");
  
  // Extract code blocks that have filepaths
  const codeBlocksWithFilepaths = useMemo(() => {
    const blocks: Array<{ filepath: string; code: string; lang?: string }> = [];
    
    parsedContent.forEach((item) => {
      if (typeof item === "object" && item.type === "block") {
        const blockData = item as UniversalBlockData;
        if (blockData.filepath && blockData.filepath.trim()) {
          blocks.push({
            filepath: blockData.filepath,
            code: blockData.code,
            lang: blockData.lang,
          });
        }
      }
    });
    
    return blocks;
  }, [parsedContent]);

  const handleZipDownload = useCallback(async () => {
    if (codeBlocksWithFilepaths.length === 0) {
      toast.info(t('actions.noCodeBlocksToDownload', 'No code blocks with filepaths found to download'));
      return;
    }

    try {
      const zip = new JSZip();
      
      // Track directories to create them if needed
      const createdDirs = new Set<string>();
      
      // Add each code block to the ZIP
      codeBlocksWithFilepaths.forEach(({ filepath, code }) => {
        // Normalize the filepath (remove leading slashes, handle Windows paths)
        const normalizedPath = filepath.replace(/^[\/\\]+/, '').replace(/\\/g, '/');
        
        // Create directories if needed
        const pathParts = normalizedPath.split('/');
        if (pathParts.length > 1) {
          // Create parent directories
          for (let i = 1; i < pathParts.length; i++) {
            const dirPath = pathParts.slice(0, i).join('/');
            if (!createdDirs.has(dirPath)) {
              zip.folder(dirPath);
              createdDirs.add(dirPath);
            }
          }
        }
        
        // Handle potential duplicate filenames by adding a suffix
        let finalPath = normalizedPath;
        let counter = 1;
        while (zip.file(finalPath)) {
          const lastDotIndex = normalizedPath.lastIndexOf('.');
          if (lastDotIndex > 0) {
            const nameWithoutExt = normalizedPath.substring(0, lastDotIndex);
            const extension = normalizedPath.substring(lastDotIndex);
            finalPath = `${nameWithoutExt}_${counter}${extension}`;
          } else {
            finalPath = `${normalizedPath}_${counter}`;
          }
          counter++;
        }
        
        // Add the file to the ZIP
        zip.file(finalPath, code);
      });

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        }
      });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename based on interaction or use default
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const interactionId = context.interactionId?.slice(0, 8) || 'unknown';
      link.download = `codeblocks_${interactionId}_${timestamp}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      toast.success(t('actions.downloadZip', `Downloaded {{count}} code files as ZIP`, { count: codeBlocksWithFilepaths.length }));
    } catch (error) {
      console.error('ZIP download failed:', error);
      toast.error(t('actions.zipDownloadFailed', 'Failed to create ZIP file'));
    }
  }, [codeBlocksWithFilepaths, context.interactionId, t]);

  // Don't render if there are no code blocks with filepaths
  if (codeBlocksWithFilepaths.length === 0) {
    return null;
  }

  return (
    <ActionTooltipButton
      tooltipText={t('actions.downloadZip', `Download {{count}} code files as ZIP`, { count: codeBlocksWithFilepaths.length })}
      onClick={handleZipDownload}
      aria-label={t('actions.downloadZipAriaLabel', 'Download code blocks as ZIP file')}
      icon={<ArchiveIcon />}
      iconClassName="h-4 w-4"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
    />
  );
}; 