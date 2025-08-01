import React, { useCallback } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ImageBlockRendererProps {
  src: string;
  alt?: string;
  className?: string;
}

export const ImageBlockRenderer: React.FC<ImageBlockRendererProps> = ({
  src,
  alt = "Generated Image",
  className = "",
}) => {
  const { t } = useTranslation('renderers');

  const handleDownload = useCallback(async () => {
    try {
      // Generate a descriptive filename
      let filename = 'generated-image';
      if (alt && alt !== "Generated Image") {
        // Sanitize alt text for filename
        filename = alt.replace(/[^a-z0-9\-_]+/gi, '_').replace(/^_+|_+$/g, '');
      }
      filename = `${filename || 'generated-image'}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = src;
      link.click();
      
      toast.success(t('imageBlock.downloadSuccess') || 'Image downloaded successfully');
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error(t('imageBlock.downloadFailed') || 'Failed to download image');
    }
  }, [src, alt, t]);

  return (
    <div className="relative inline-block group my-4">
      <img 
        src={src} 
        alt={alt} 
        className={`max-w-full h-auto rounded-lg ${className}`}
      />
      <button
        onClick={handleDownload}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        title={t('imageBlock.downloadTitle') || 'Download Image'}
      >
        <DownloadIcon className="h-4 w-4" />
      </button>
    </div>
  );
};