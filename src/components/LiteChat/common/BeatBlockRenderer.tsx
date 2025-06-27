import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";

import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { InlineCodeEditor } from "@/controls/components/canvas/codeblock/EditCodeBlockControl";
import { Loader2Icon, CodeIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { ActionTooltipButton } from "./ActionTooltipButton";

// Strudel embed types declaration
declare global {
  interface Window {
    strudelEmbed?: any;
    strudelLoaded?: boolean;
    strudelLoading?: boolean;
  }
  
  namespace JSX {
    interface IntrinsicElements {
      'strudel-repl': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        code?: string;
      };
    }
  }
}

interface BeatBlockRendererProps {
  code: string;
  isStreaming?: boolean;
  interactionId?: string;
  blockId?: string;
  module?: any; // Optional module for enhanced context access
}

// Global Strudel manager
class GlobalStrudelManager {
  private static instance: GlobalStrudelManager;
  private loadPromise: Promise<void> | null = null;

  static getInstance(): GlobalStrudelManager {
    if (!GlobalStrudelManager.instance) {
      GlobalStrudelManager.instance = new GlobalStrudelManager();
    }
    return GlobalStrudelManager.instance;
  }

  async ensureStrudelLoaded(): Promise<void> {
    // If already loaded, return immediately
    if (window.strudelLoaded && document.querySelector('script[src*="@strudel/embed"]')) {
      return;
    }

    // If already loading, wait for that promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    window.strudelLoading = true;
    
    this.loadPromise = this.loadStrudel();
    return this.loadPromise;
  }

  private async loadStrudel(): Promise<void> {
    try {
      // Check if script already exists
      if (!document.querySelector('script[src*="@strudel/embed"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@strudel/embed@latest';
        script.type = 'module';
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        // Wait a bit for the custom element to be defined
        // Wait for the custom element to be defined
        await customElements.whenDefined('strudel-repl');
      }

      window.strudelLoaded = true;
      window.strudelLoading = false;
      
      toast.success("Strudel environment ready!");

    } catch (error) {
      window.strudelLoading = false;
      console.error("Failed to load Strudel:", error);
      toast.error("Failed to load Strudel environment");
      throw error;
    }
  }

  /**
   * Disposes the GlobalStrudelManager singleton and resets all related state.
   */
  static dispose(): void {
    if (GlobalStrudelManager.instance) {
      GlobalStrudelManager.instance.loadPromise = null;
      GlobalStrudelManager.instance = null as any;
    }
    window.strudelLoaded = false;
    window.strudelLoading = false;
  }
}

const BeatBlockRendererComponent: React.FC<BeatBlockRendererProps> = ({
  code,
  isStreaming = false,
  interactionId,
  blockId,
}) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );
  
  const runnableBlocksEnabled = true;

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [showCode, setShowCode] = useState(true);
  const [showRepl, setShowRepl] = useState(false);
  const [strudelLoaded, setStrudelLoaded] = useState(false);

  // Get global Strudel manager
  const strudelManager = useMemo(() => GlobalStrudelManager.getInstance(), []);

  // Update edited code when original code changes
  useEffect(() => {
    if (!isEditing) {
      setEditedCode(code);
    }
  }, [code, isEditing]);

  const codeRef = useRef<HTMLElement>(null);
  const strudelRef = useRef<HTMLElement>(null);

  // Load Strudel only when Run is clicked
  const handleRunClick = async () => {
    try {
      await strudelManager.ensureStrudelLoaded();
      setStrudelLoaded(true);
      setShowRepl(true);
      setShowCode(false);
    } catch (error) {
      console.error("Failed to load Strudel:", error);
    }
  };

  const handleShowCode = () => {
    setShowCode(true);
    setShowRepl(false);
  };

  // Update Strudel REPL content when code changes
  useEffect(() => {
    if (strudelLoaded && strudelRef.current && !isEditing) {
      const strudelElement = strudelRef.current as any;
      if (strudelElement && typeof strudelElement.setAttribute === 'function') {
        strudelElement.setAttribute('code', code);
      }
    }
  }, [code, strudelLoaded, isEditing]);

  // Update Strudel REPL content when edited code changes during editing
  useEffect(() => {
    if (strudelLoaded && strudelRef.current && isEditing) {
      const strudelElement = strudelRef.current as any;
      if (strudelElement && typeof strudelElement.setAttribute === 'function') {
        strudelElement.setAttribute('code', editedCode);
      }
    }
  }, [editedCode, strudelLoaded, isEditing]);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      _currentLang?: string,
      _currentFilepath?: string,
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
              codeBlockEditedContent: editedCode,
              codeBlockLang: "beat",
              codeBlockFilepath: undefined,
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
              interactionId: interactionId,
              blockId: blockId,
              onEditModeChange: setIsEditing,
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
    [canvasControls, editedCode, interactionId, blockId, setIsEditing]
  );

  const highlightCode = useCallback(() => {
    if (codeRef.current && (isEditing ? editedCode : code)) {
      try {
        if (codeRef.current.style.whiteSpace !== "pre-wrap") {
          codeRef.current.style.whiteSpace = "pre-wrap";
        }
        codeRef.current.textContent = isEditing ? editedCode : code;
        Prism.highlightElement(codeRef.current);
      } catch (error) {
        console.error("Prism highlight error:", error);
        codeRef.current.textContent = isEditing ? editedCode : code;
      }
    } else if (codeRef.current) {
      codeRef.current.textContent = "";
    }
  }, [code, editedCode, isEditing]);

  useEffect(() => {
    if (showCode && !isFolded) {
      highlightCode();
    }
  }, [code, editedCode, isEditing, isFolded, showCode, highlightCode]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding && showCode) {
      setTimeout(highlightCode, 0);
    }
  };



  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    isEditing ? editedCode : code,
    "beat",
    undefined,
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">BEAT</div>
          {window.strudelLoading && (
            <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
              Loading...
            </div>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showRepl ? (
            <ActionTooltipButton
              tooltipText="Show/Hide Code"
              onClick={handleShowCode}
              className="text-xs h-7 w-7"
              icon={<CodeIcon className="h-3 w-3 mr-1" />}
              variant={showCode ? "outline" : "default"}
            />
          ) : (
            <ActionTooltipButton
              tooltipText={showCode ? 'Hide Code' : 'Show Code'}
              onClick={() => setShowCode(!showCode)}
              className="text-xs h-7 w-7"
              icon={<CodeIcon className="h-3 w-3 mr-1" />}
              variant={showCode ? "default" : "outline"}
            />
          )}
          {!showRepl && (
            <ActionTooltipButton
              tooltipText="Run"
              onClick={handleRunClick}
              disabled={!runnableBlocksEnabled || window.strudelLoading}
              className="text-xs h-7 w-7"
              icon={window.strudelLoading ? (
                <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <PlayIcon className="h-3 w-3 mr-1" />
              )}
              variant="default"
            />
          )}
        </div>
      </div>

      {/* Strudel REPL - Only visible when showRepl is true and not folded or editing */}
      {!isFolded && !isEditing && strudelLoaded && showRepl && (
        <div className="strudel-container border border-border rounded-b-lg bg-background overflow-hidden" style={{ height: '500px' }}>
          <style>
            {`
              .strudel-container iframe {
                width: 100% !important;
                height: 100% !important;
                border: none !important;
              }
            `}
          </style>
          {React.createElement('strudel-repl', {
            ref: strudelRef,
            code: code,
            style: {
              width: '100%',
              height: '100%',
              display: 'block'
            }
          })}
        </div>
      )}

      {/* Code view - shown when showCode is true */}
      {!isFolded && showCode && (
        <div className="overflow-hidden w-full">
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code 
              ref={codeRef} 
              className="language-javascript block p-4 font-mono text-sm leading-relaxed"
            />
          </pre>
        </div>
      )}
      
      {/* Inline editor */}
      {!isFolded && isEditing && (
        <div className="overflow-hidden w-full border border-border rounded-b-lg bg-muted/20">
          <InlineCodeEditor
            code={editedCode}
            language="javascript"
            onChange={setEditedCode}
          />
        </div>
      )}

      {/* Loading state */}
      {!isFolded && !strudelLoaded && window.strudelLoading && !showRepl && (
        <div className="border border-border rounded-b-lg bg-muted/20 p-8 text-center">
          <Loader2Icon className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-sm text-muted-foreground">Loading Strudel environment...</div>
        </div>
      )}
    </div>
  );
};

export const BeatBlockRenderer = memo(BeatBlockRendererComponent); 