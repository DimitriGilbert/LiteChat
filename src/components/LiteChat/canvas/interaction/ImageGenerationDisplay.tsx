import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Copy, Palette } from "lucide-react";
import type { ImageGenerationResult } from "@/services/ai-image-generation.service";

interface ImageGenerationDisplayProps {
  result: ImageGenerationResult;
  prompt: string;
  className?: string;
}

export const ImageGenerationDisplay: React.FC<ImageGenerationDisplayProps> = ({
  result,
  prompt,
  className = "",
}) => {
  const handleDownload = () => {
    // Create a download link for the image
    const link = document.createElement("a");
    link.href = result.image;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyImage = async () => {
    try {
      // If it's a URL, fetch and copy to clipboard
      if (result.image.startsWith("http")) {
        const response = await fetch(result.image);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      } else if (result.image.startsWith("data:")) {
        // If it's base64, convert and copy
        const response = await fetch(result.image);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      }
    } catch (error) {
      console.error("Failed to copy image:", error);
    }
  };

  return (
    <Card className={`w-full max-w-2xl ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-medium">Generated Image</span>
          <Badge variant="secondary" className="text-xs">
            {result.finishReason}
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div className="relative group">
            <img
              src={result.image}
              alt={`Generated image: ${prompt}`}
              className="w-full rounded-lg shadow-md"
              style={{ maxHeight: "512px", objectFit: "contain" }}
            />
            
            {/* Action buttons overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={handleCopyImage}
                  title="Copy image"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={handleDownload}
                  title="Download image"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <strong>Prompt:</strong> {prompt}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 