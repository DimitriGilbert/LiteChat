import React, { useMemo } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useShallow } from "zustand/react/shallow";
import { BlockRendererService } from "@/services/block-renderer.service";
import type { BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { nanoid } from "nanoid";

interface UniversalBlockRendererProps {
  lang: string | undefined;
  code: string;
  filepath?: string;
  isStreaming?: boolean;
}

const UniversalBlockRenderer: React.FC<UniversalBlockRendererProps> = ({
  lang,
  code,
  filepath,
  isStreaming = false,
}) => {
  const blockRenderers = useControlRegistryStore(
    useShallow((state) => state.blockRenderers)
  );

  const blockId = useMemo(() => nanoid(), []);

  const renderedBlock = useMemo(() => {
    const context: BlockRendererContext = {
      lang,
      code,
      filepath,
      isStreaming,
      blockId,
    };

    const renderer = BlockRendererService.findRendererForLanguage(lang, blockRenderers);
    
    if (!renderer) {
      // Fallback to a simple pre/code block if no renderer is found
      const languageClass = lang ? `language-${lang}` : "language-plaintext";
      return (
        <div className="code-block-container my-4 max-w-full">
          <div className="code-block-header flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
            <div className="text-sm font-medium">
              {lang ? lang.toUpperCase() : "CODE"}
            </div>
          </div>
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code className={`${languageClass} block p-4 font-mono text-sm leading-relaxed`}>
              {code}
            </code>
          </pre>
        </div>
      );
    }

    try {
      return renderer.renderer(context);
    } catch (error) {
      console.error(`[UniversalBlockRenderer] Error rendering block with renderer ${renderer.id}:`, error);
      // Fallback to simple rendering on error
      return (
        <div className="code-block-container my-4 max-w-full">
          <div className="code-block-header flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
            <div className="text-sm font-medium text-destructive">
              {lang ? lang.toUpperCase() : "CODE"} (Render Error)
            </div>
          </div>
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code className="block p-4 font-mono text-sm leading-relaxed">
              {code}
            </code>
          </pre>
        </div>
      );
    }
  }, [lang, code, filepath, isStreaming, blockId, blockRenderers]);

  return <>{renderedBlock}</>;
};

export { UniversalBlockRenderer }; 