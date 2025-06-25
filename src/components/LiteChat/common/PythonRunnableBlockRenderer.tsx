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
import { PlayIcon, Loader2Icon, EyeIcon, CodeIcon, DownloadIcon, ShieldIcon, ShieldCheckIcon, MonitorSpeakerIcon } from "lucide-react";
import { toast } from "sonner";
import { PYODIDE_VERSION_URL } from "@/lib/litechat/constants";
import { CodeSecurityService, type CodeSecurityResult } from "@/services/code-security.service";

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
  module?: any; // Optional module for enhanced context access
}

// Add a constant for the directory
const PYODIDE_INDEX_URL = PYODIDE_VERSION_URL.replace(/\/pyodide\.js$/, '/');

const PythonRunnableBlockRendererComponent: React.FC<PythonRunnableBlockRendererProps> = ({
  code,
  isStreaming = false,
  interactionId,
  blockId,
  module,
}) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );
  
  // For now, enable runnable blocks as this is an advanced feature
  // TODO: Implement granular control using runnableBlockConfig when store is fixed
  const runnableBlocksEnabled = true;

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);

  // Security validation state
  const [securityResult, setSecurityResult] = useState<CodeSecurityResult | null>(null);
  const [isCheckingSecurity, setIsCheckingSecurity] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Update edited code when original code changes
  useEffect(() => {
    if (!isEditing) {
      setEditedCode(code);
    }
  }, [code, isEditing]);

  // Reset security state when code changes
  useEffect(() => {
    setSecurityResult(null);
    setClickCount(0);
  }, [editedCode]);

  const codeRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null); // Simple target element reference

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
          indexURL: PYODIDE_INDEX_URL,
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
      script.src = PYODIDE_VERSION_URL;
      script.onload = async () => {
        try {
          window.pyodide = await window.loadPyodide({
            indexURL: PYODIDE_INDEX_URL,
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
    if (!isFolded && !showOutput && !showPreview) {
      highlightCode();
    }
  }, [code, editedCode, isEditing, isFolded, showOutput, showPreview, highlightCode]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding) {
      setTimeout(highlightCode, 0);
    }
  };

  const checkSecurity = useCallback(async () => {
    setIsCheckingSecurity(true);
    try {
      const codeToCheck = isEditing ? editedCode : code;
      const result = await CodeSecurityService.validateCodeSecurity(codeToCheck, 'python');
      setSecurityResult(result);
      
      if (result.score > 90) {
        toast.error(`High-risk code detected (Score: ${result.score}/100). Please review carefully before running.`);
      } else if (result.score > 60) {
        toast.warning(`Potentially risky code detected (Score: ${result.score}/100). Use caution when running.`);
      } else if (result.score > 30) {
        toast.info(`Moderate-risk code detected (Score: ${result.score}/100). Review before running.`);
      } else {
        toast.success(`Code security check passed (Score: ${result.score}/100).`);
      }
    } catch (error) {
      console.error("Security check failed:", error);
      toast.error("Security check failed. Please try again.");
    } finally {
      setIsCheckingSecurity(false);
    }
  }, [code, editedCode, isEditing]);

  const handleRunClick = useCallback(async () => {
    if (!runnableBlocksEnabled) {
      toast.error("Runnable blocks are disabled in settings.");
      return;
    }

    if (!pyodideReady) {
      await loadPyodide();
      return;
    }

    // If security result exists and requires multiple clicks
    if (securityResult) {
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime;
      
      // Reset click count if more than 3 seconds have passed
      if (timeSinceLastClick > 3000) {
        setClickCount(0);
      }
      
      setLastClickTime(now);
      const newClickCount = clickCount + 1;
      setClickCount(newClickCount);

      // Check if we need more clicks
      if (newClickCount < securityResult.clicksRequired) {
        const remaining = securityResult.clicksRequired - newClickCount;
        toast.info(`Click ${remaining} more time${remaining > 1 ? 's' : ''} to confirm execution (Risk: ${securityResult.riskLevel})`);
        return;
      }

      // Show additional warning for high-risk code
      if (securityResult.score > 90) {
        if (!confirm(`This code has a very high security risk score (${securityResult.score}/100). Are you absolutely sure you want to run it?`)) {
          setClickCount(0);
          return;
        }
      }

      // Reset click count and execute
      setClickCount(0);
    }

    executeCode();
  }, [securityResult, clickCount, lastClickTime, runnableBlocksEnabled, pyodideReady, loadPyodide]);

  const executeCode = useCallback(async () => {
    if (!window.pyodide) return;

    setIsRunning(true);
    const capturedLogs: string[] = [];

    // Clear the preview target
    if (previewRef.current) {
      previewRef.current.innerHTML = '';
    }

    try {
      // Setup stdout/stderr capture
      window.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      // Get enhanced context if module is provided
      let contextObj: any = {};
      if (module && module.getEnhancedContext) {
        try {
          contextObj = module.getEnhancedContext(capturedLogs, previewRef.current);
        } catch (error) {
          console.warn("Failed to get enhanced context:", error);
        }
      }
      // Fallback context if module is not available
      if (!contextObj.litechat) {
        contextObj = {
          litechat: {
            utils: {
              log: (level: string, ...args: any[]) => {
                const formatted = args.map(arg => {
                  if (typeof arg === 'object') {
                    try {
                      return JSON.stringify(arg, null, 2);
                    } catch {
                      return String(arg);
                    }
                  }
                  return String(arg);
                }).join(' ');
                const logEntry = level === 'info' ? formatted : `${level.charAt(0).toUpperCase() + level.slice(1)}: ${formatted}`;
                capturedLogs.push(logEntry);
              },
              toast: (_type: string, message: string) => {
                toast(message);
              }
            }
          },
          target: previewRef.current
        };
      }

      // Make enhanced LiteChat context available in Python global namespace
      window.pyodide.globals.set("litechat", contextObj.litechat);
      window.pyodide.globals.set("target", contextObj.target);

      // Execute the Python code
      const codeToRun = isEditing ? editedCode : code;
      await window.pyodide.runPython(codeToRun);

      // Get the captured output
      const stdout = window.pyodide.runPython("sys.stdout.getvalue()") as string;
      const stderr = window.pyodide.runPython("sys.stderr.getvalue()") as string;

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
      setHasRun(true);
      setIsRunning(false);

      // Auto-show preview if target has content, otherwise show console
      if (previewRef.current && (previewRef.current.children.length > 0 || previewRef.current.innerHTML.trim())) {
        setShowPreview(true);
        setShowOutput(false);
      } else {
        setShowOutput(true);
        setShowPreview(false);
      }

      if (capturedLogs.some(log => log.startsWith('Execution Error:') || log.startsWith('Error:'))) {
        toast.error("Python execution failed - check output for details");
      } else {
        toast.success("Python code executed successfully");
      }
    }
  }, [code, editedCode, isEditing, pyodideReady, loadPyodide, module]);

  const toggleConsole = () => {
    setShowOutput(true);
    setShowPreview(false);
  };

  const togglePreview = () => {
    setShowPreview(true);
    setShowOutput(false);
  };

  const toggleCode = () => {
    setShowOutput(false);
    setShowPreview(false);
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

  // Determine run button style based on security result
  const getRunButtonStyle = () => {
    if (!securityResult) return {};
    
    return {
      backgroundColor: securityResult.color,
      borderColor: securityResult.color,
      color: securityResult.score > 50 ? '#ffffff' : '#000000',
    };
  };

  const getRunButtonText = () => {
    if (isRunning) return "Running...";
    if (isLoading) return "Loading...";
    if (!pyodideReady) return "Load Python";
    if (securityResult && clickCount > 0 && clickCount < securityResult.clicksRequired) {
      return `Click ${securityResult.clicksRequired - clickCount} more`;
    }
    return "Run";
  };

  // Check if preview has content (either DOM children or innerHTML content)
  const hasPreviewContent = hasRun && previewRef.current && (
    previewRef.current.children.length > 0 || 
    previewRef.current.innerHTML.trim().length > 0
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">RUNNABLE PYTHON</div>
          {!pyodideReady && (
            <div className="text-xs text-muted-foreground">(Pyodide)</div>
          )}
          {securityResult && (
            <div className="flex items-center gap-1 text-xs" style={{ color: securityResult.color }}>
              <ShieldIcon className="h-3 w-3" />
              <span>{securityResult.score}/100 ({securityResult.riskLevel})</span>
            </div>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={checkSecurity}
            disabled={isCheckingSecurity}
            className="text-xs h-7"
          >
            {isCheckingSecurity ? (
              <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
            )}
            {securityResult ? 'Recheck' : 'Check'}
          </Button>
          {hasRun && (
            <>
              <Button
                size="sm"
                variant={!showOutput && !showPreview ? "default" : "outline"}
                onClick={toggleCode}
                className="text-xs h-7"
              >
                <CodeIcon className="h-3 w-3 mr-1" />
                Code
              </Button>
              <Button
                size="sm"
                variant={showOutput ? "default" : "outline"}
                onClick={toggleConsole}
                className="text-xs h-7"
              >
                <MonitorSpeakerIcon className="h-3 w-3 mr-1" />
                Console
              </Button>
              <Button
                size="sm"
                variant={showPreview ? "default" : "outline"}
                onClick={togglePreview}
                className="text-xs h-7"
              >
                <EyeIcon className="h-3 w-3 mr-1" />
                Preview
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={handleRunClick}
            disabled={isRunning || isLoading || !runnableBlocksEnabled}
            className="text-xs h-7"
            style={getRunButtonStyle()}
          >
            {isRunning || isLoading ? (
              <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
            ) : !pyodideReady ? (
              <DownloadIcon className="h-3 w-3 mr-1" />
            ) : (
              <PlayIcon className="h-3 w-3 mr-1" />
            )}
            {getRunButtonText()}
          </Button>
        </div>
      </div>

      {!isFolded && !showOutput && !showPreview && !isEditing && (
        <div className="overflow-hidden w-full">
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code 
              ref={codeRef} 
              className="language-python block p-4 font-mono text-sm leading-relaxed"
            />
          </pre>
        </div>
      )}
      
      {!isFolded && !showOutput && !showPreview && isEditing && (
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

      {/* ALWAYS render preview element (hidden when not shown) so ref is always available */}
      <div ref={previewRef} className={!isFolded && showPreview ? "preview-container border border-border rounded-b-lg bg-background p-4" : "hidden"}>
        {!isFolded && showPreview && (
          <>
            <div className="preview-header text-muted-foreground mb-2 text-xs font-semibold">
              PREVIEW:
            </div>
            {/* The target element for DOM manipulation */}
            <div className="preview-content min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-2">
              {!hasPreviewContent && (
                <div className="text-muted-foreground text-sm italic">
                  No preview content. Use <code>litechat.target.appendChild(element)</code> to add DOM elements here.
                </div>
              )}
            </div>
          </>
        )}
      </div>

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