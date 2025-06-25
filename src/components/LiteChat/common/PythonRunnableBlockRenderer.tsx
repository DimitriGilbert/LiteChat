import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import Prism from "prismjs";
import "prismjs/components/prism-python";

import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { InlineCodeEditor } from "@/controls/components/canvas/codeblock/EditCodeBlockControl";
import { Button } from "@/components/ui/button";
import { PlayIcon, Loader2Icon, EyeIcon, CodeIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";

const pyodideVersionUrl = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";

// Pyodide types declaration
declare global {
  interface Window {
    pyodide?: any;
    loadPyodide?: any;
  }
}

interface PythonRunnableBlockRendererProps {
  code: string;
  isStreaming?: boolean;
  interactionId?: string;
  blockId?: string;
}

const PythonRunnableBlockRendererComponent: React.FC<PythonRunnableBlockRendererProps> = ({
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
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);

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

  // Load Pyodide on demand
  const loadPyodide = useCallback(async () => {
    if (window.pyodide) {
      setPyodideReady(true);
      return;
    }

    if (window.loadPyodide) {
      setIsLoading(true);
      try {
        window.pyodide = await window.loadPyodide({
          indexURL: pyodideVersionUrl,
        });
        setPyodideReady(true);
        toast.success("Python environment ready");
      } catch (error) {
        console.error("Failed to load Pyodide:", error);
        toast.error("Failed to load Python environment");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Load Pyodide script if not already loaded
      setIsLoading(true);
      const script = document.createElement('script');
      script.src = pyodideVersionUrl;
      script.onload = async () => {
        try {
          window.pyodide = await window.loadPyodide({
            indexURL: pyodideVersionUrl,
          });
          setPyodideReady(true);
          toast.success("Python environment ready");
        } catch (error) {
          console.error("Failed to load Pyodide:", error);
          toast.error("Failed to load Python environment");
        } finally {
          setIsLoading(false);
        }
      };
      script.onerror = () => {
        console.error("Failed to load Pyodide script");
        toast.error("Failed to load Python environment");
        setIsLoading(false);
      };
      document.head.appendChild(script);
    }
  }, []);

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
              codeBlockLang: "python",
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
    if (!pyodideReady) {
      await loadPyodide();
      return;
    }

    setIsRunning(true);
    const capturedLogs: string[] = [];

    try {
      // Redirect Python stdout to capture print statements
      window.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      // Execute the Python code
      const codeToRun = isEditing ? editedCode : code;
      await window.pyodide.runPython(codeToRun);

      // Get the captured output
      const stdout = window.pyodide.runPython("sys.stdout.getvalue()");
      const stderr = window.pyodide.runPython("sys.stderr.getvalue()");

      if (stdout) {
        stdout.split('\n').forEach((line: string) => {
          if (line.trim()) capturedLogs.push(line);
        });
      }

      if (stderr) {
        stderr.split('\n').forEach((line: string) => {
          if (line.trim()) capturedLogs.push(`Error: ${line}`);
        });
      }

      if (capturedLogs.length === 0) {
        capturedLogs.push("Code executed successfully (no output)");
      }

      // Reset stdout/stderr for next execution
      window.pyodide.runPython(`
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

    } catch (error) {
      capturedLogs.push(`Execution Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOutput(capturedLogs);
      setShowOutput(true);
      setHasRun(true);
      setIsRunning(false);

      if (capturedLogs.some(log => log.startsWith('Execution Error:') || log.startsWith('Error:'))) {
        toast.error("Python execution failed - check output for details");
      } else {
        toast.success("Python code executed successfully");
      }
    }
  }, [code, editedCode, isEditing, pyodideReady, loadPyodide]);

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
    "python",
    undefined,
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">RUNNABLE PYTHON</div>
          {!pyodideReady && (
            <div className="text-xs text-muted-foreground">(Pyodide)</div>
          )}
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
            disabled={isRunning || isLoading}
            className="text-xs h-7"
          >
            {isRunning || isLoading ? (
              <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
            ) : !pyodideReady ? (
              <DownloadIcon className="h-3 w-3 mr-1" />
            ) : (
              <PlayIcon className="h-3 w-3 mr-1" />
            )}
            {isLoading ? "Loading..." : !pyodideReady ? "Load Python" : "Run"}
          </Button>
        </div>
      </div>

      {!isFolded && !showOutput && !isEditing && (
        <div className="overflow-hidden w-full">
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code 
              ref={codeRef} 
              className="language-python block p-4 font-mono text-sm leading-relaxed"
            />
          </pre>
        </div>
      )}
      
      {!isFolded && !showOutput && isEditing && (
        <div className="overflow-hidden w-full border border-border rounded-b-lg bg-muted/20">
          <InlineCodeEditor
            code={editedCode}
            language="python"
            onChange={setEditedCode}
          />
        </div>
      )}

      {!isFolded && showOutput && (
        <div className="output-container border border-border rounded-b-lg bg-black/90 text-green-400 p-4 font-mono text-sm">
          <div className="output-header text-green-300 mb-2 text-xs font-semibold">
            PYTHON OUTPUT:
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

export const PythonRunnableBlockRenderer = memo(PythonRunnableBlockRendererComponent); 