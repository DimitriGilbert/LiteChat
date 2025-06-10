import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { createMermaidRenderer } from "mermaid-isomorphic";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";

interface MermaidBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

const MermaidBlockRendererComponent: React.FC<MermaidBlockRendererProps> = ({
  code,
  isStreaming = false,
}) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      // @ts-expect-error unused, do not feel like fixing type for now
      currentLang?: string,
      currentIsFolded?: boolean,
      currentToggleFold?: () => void
    ): React.ReactNode[] => {
      return canvasControls
        .filter(
          (c) =>
            c.type === "codeblock" &&
            c.targetSlot === targetSlotName &&
            c.renderer
        )
        .map((control) => {
          if (control.renderer) {
            const context: CanvasControlRenderContext = {
              codeBlockContent: currentCode,
              codeBlockLang: "mermaid",
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
            };
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean);
    },
    [canvasControls]
  );

  const renderMermaid = useCallback(async () => {
    if (!code.trim() || isFolded) return;

    setIsLoading(true);
    setError(null);
    setSvgContent(null);

    try {
      // Create renderer with default options
      const renderer = createMermaidRenderer();
      
      const results = await renderer([code]);
      
      if (results.length > 0 && results[0].status === "fulfilled") {
        setSvgContent(results[0].value.svg);
      } else if (results.length > 0 && results[0].status === "rejected") {
        const reason = results[0].reason;
        setError(reason?.message || "Failed to render Mermaid diagram");
      } else {
        setError("No results returned from Mermaid renderer");
      }
    } catch (err) {
      console.error("Mermaid rendering error:", err);
      setError(err instanceof Error ? err.message : "Failed to render Mermaid diagram");
    } finally {
      setIsLoading(false);
    }
  }, [code, isFolded]);

  useEffect(() => {
    if (!isFolded && code.trim()) {
      renderMermaid();
    }
  }, [code, isFolded, renderMermaid]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding) {
      setTimeout(renderMermaid, 0);
    }
  };

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code
      .split("\n")
      .slice(0, 3)
      .join("\n");
  }, [code]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    code,
    "mermaid",
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">MERMAID</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div></div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Rendering diagram...
              </span>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 p-4 border border-destructive/20 bg-destructive/10 rounded-md">
              <AlertCircleIcon className="h-5 w-5 text-destructive flex-shrink-0" />
              <div className="text-sm text-destructive">
                <div className="font-medium">Failed to render Mermaid diagram</div>
                <div className="text-xs mt-1 opacity-80">{error}</div>
              </div>
            </div>
          )}
          
          {svgContent && !isLoading && !error && (
            <div 
              ref={containerRef}
              className="mermaid-container p-4 bg-background border rounded-md overflow-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      )}
      
      {isFolded && (
        <div
          className="folded-content-preview p-4 cursor-pointer w-full box-border"
          onClick={toggleFold}
        >
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm">
            {foldedPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
};

export const MermaidBlockRenderer = memo(MermaidBlockRendererComponent); 