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
import { Button } from "@/components/ui/button";
import { PlayIcon, Loader2Icon, EyeIcon, CodeIcon } from "lucide-react";
import { toast } from "sonner";

interface JsRunnableBlockRendererProps {
  code: string;
  isStreaming?: boolean;
  interactionId?: string;
  blockId?: string;
}

const JsRunnableBlockRendererComponent: React.FC<JsRunnableBlockRendererProps> = ({
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

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Update edited code when original code changes
  useEffect(() => {
    if (!isEditing) {
      setEditedCode(code);
    }
  }, [code, isEditing]);

  const codeRef = useRef<HTMLElement>(null);

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
              codeBlockLang: "javascript",
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
    [canvasControls, editedCode, interactionId, setIsEditing]
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
    if (!isFolded && !showOutput) {
      highlightCode();
    }
  }, [code, editedCode, isEditing, isFolded, showOutput, highlightCode]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding) {
      setTimeout(highlightCode, 0);
    }
  };

  const executeCode = useCallback(async () => {
    setIsRunning(true);
    const capturedLogs: string[] = [];
    
    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      capturedLogs.push(args.join(' '));
      originalLog(...args);
    };
    
    console.error = (...args) => {
      capturedLogs.push(`Error: ${args.join(' ')}`);
      originalError(...args);
    };
    
    console.warn = (...args) => {
      capturedLogs.push(`Warning: ${args.join(' ')}`);
      originalWarn(...args);
    };

    try {
      // Execute the code in an isolated context
      const codeToRun = isEditing ? editedCode : code;
      const func = new Function(codeToRun);
      await func();
      
      if (capturedLogs.length === 0) {
        capturedLogs.push("Code executed successfully (no output)");
      }
    } catch (error) {
      capturedLogs.push(`Execution Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      
      setOutput(capturedLogs);
      setShowOutput(true);
      setHasRun(true);
      setIsRunning(false);
      
      if (capturedLogs.some(log => log.startsWith('Execution Error:'))) {
        toast.error("Code execution failed - check output for details");
      } else {
        toast.success("Code executed successfully");
      }
    }
  }, [code, editedCode, isEditing]);

  const toggleView = () => {
    setShowOutput(!showOutput);
  };

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code
      .split('\n')
      .slice(0, 3)
      .join('\n');
  }, [code]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    isEditing ? editedCode : code,
    "javascript",
    undefined,
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">RUNNABLE JS</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasRun && (
            <Button
              size="sm"
              variant="outline"
              onClick={toggleView}
              className="text-xs h-7"
            >
              {showOutput ? (
                <>
                  <CodeIcon className="h-3 w-3 mr-1" />
                  Code
                </>
              ) : (
                <>
                  <EyeIcon className="h-3 w-3 mr-1" />
                  Output
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={executeCode}
            disabled={isRunning}
            className="text-xs h-7"
          >
            {isRunning ? (
              <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <PlayIcon className="h-3 w-3 mr-1" />
            )}
            Run
          </Button>
        </div>
      </div>

      {!isFolded && !showOutput && !isEditing && (
        <div className="overflow-hidden w-full">
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code 
              ref={codeRef} 
              className="language-javascript block p-4 font-mono text-sm leading-relaxed"
            />
          </pre>
        </div>
      )}
      
      {!isFolded && !showOutput && isEditing && (
        <div className="overflow-hidden w-full border border-border rounded-b-lg bg-muted/20">
          <InlineCodeEditor
            code={editedCode}
            language="javascript"
            onChange={setEditedCode}
          />
        </div>
      )}

      {!isFolded && showOutput && (
        <div className="output-container border border-border rounded-b-lg bg-black/90 text-green-400 p-4 font-mono text-sm">
          <div className="output-header text-green-300 mb-2 text-xs font-semibold">
            OUTPUT:
          </div>
          {output.length > 0 ? (
            output.map((line, i) => (
              <div 
                key={i} 
                className={
                  line.startsWith('Execution Error:') ? 'text-red-400' :
                  line.startsWith('Error:') ? 'text-red-400' :
                  line.startsWith('Warning:') ? 'text-yellow-400' :
                  'text-green-400'
                }
              >
                {line}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">No output</div>
          )}
        </div>
      )}

      {isFolded && (
        <div
          className="folded-content-preview p-4 cursor-pointer w-full box-border border border-t-0 border-border rounded-b-lg bg-muted/10 hover:bg-muted/20 transition-colors"
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

export const JsRunnableBlockRenderer = memo(JsRunnableBlockRendererComponent); 