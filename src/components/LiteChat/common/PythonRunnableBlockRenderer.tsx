import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useTranslation } from "react-i18next";
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
import { ActionTooltipButton } from "./ActionTooltipButton";

// Pyodide types declaration
declare global {
  interface Window {
    pyodide?: any;
    loadPyodide?: any;
    liteChatPython?: {
      isLoading: boolean;
      isReady: boolean;
      loadedPackages: Set<string>;
      loadPromise?: Promise<void>;
    };
  }
}

interface PythonRunnableBlockRendererProps {
  code: string;
  isStreaming?: boolean;
  interactionId?: string;
  blockId?: string;
  module?: any; // Optional module for enhanced context access
}

// Global Python environment manager
class GlobalPythonManager {
  private static instance: GlobalPythonManager;
  private loadPromise: Promise<void> | null = null;
  private loadedPackages = new Set<string>();

  static getInstance(): GlobalPythonManager {
    if (!GlobalPythonManager.instance) {
      GlobalPythonManager.instance = new GlobalPythonManager();
    }
    return GlobalPythonManager.instance;
  }

  async ensurePythonLoaded(): Promise<void> {
    // Initialize window.liteChatPython if not exists
    if (!window.liteChatPython) {
      window.liteChatPython = {
        isLoading: false,
        isReady: false,
        loadedPackages: new Set<string>(),
      };
    }

    // If already ready, return immediately
    if (window.pyodide && window.liteChatPython.isReady) {
      return;
    }

    // If already loading, wait for that promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    window.liteChatPython.isLoading = true;
    
    this.loadPromise = this.loadPyodide();
    return this.loadPromise;
  }

  private async loadPyodide(): Promise<void> {
    try {
      // Load Pyodide script if not already loaded
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = PYODIDE_VERSION_URL;
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Initialize Pyodide
      const indexURL = PYODIDE_VERSION_URL.replace(/\/pyodide\.js$/, '/');
      window.pyodide = await window.loadPyodide({
        indexURL: indexURL,
      });

      // Always load micropip for package management
      await window.pyodide.loadPackage(['micropip']);
      
      // Set up global Python environment
      window.pyodide.runPython(`
import sys
import traceback
from io import StringIO
import warnings

# Configure warnings
warnings.filterwarnings('ignore', category=UserWarning, message='.*non-interactive.*')

# Global output capture system
class GlobalOutputCapture:
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        self.original_excepthook = sys.excepthook
    
    def start_capture(self):
        sys.stdout = self.stdout
        sys.stderr = self.stderr
        sys.excepthook = self.debug_excepthook
    
    def stop_capture(self):
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr
        sys.excepthook = self.original_excepthook
        
        stdout_content = self.stdout.getvalue()
        stderr_content = self.stderr.getvalue()
        self.reset()
        return stdout_content, stderr_content
    
    def debug_excepthook(self, exc_type, exc_value, exc_traceback):
        """Custom exception handler that provides detailed error information"""
        if exc_traceback:
            tb_lines = traceback.format_exception(exc_type, exc_value, exc_traceback)
            self.stderr.write("\\n=== DETAILED ERROR INFORMATION ===\\n")
            self.stderr.write(f"Exception Type: {exc_type.__name__}\\n")
            self.stderr.write(f"Exception Message: {str(exc_value)}\\n")
            self.stderr.write("\\n=== FULL TRACEBACK ===\\n")
            for line in tb_lines:
                self.stderr.write(line)
            self.stderr.write("\\n=== END TRACEBACK ===\\n")
        else:
            self.stderr.write(f"Error: {exc_type.__name__}: {str(exc_value)}\\n")

# Create global output capture instance
_global_capture = GlobalOutputCapture()
      `);

      window.liteChatPython!.isReady = true;
      window.liteChatPython!.isLoading = false;
      
      toast.success("Python environment ready for all blocks!");

    } catch (error) {
      window.liteChatPython!.isLoading = false;
      console.error("Failed to load Pyodide:", error);
      toast.error("Failed to load Python environment");
      throw error;
    }
  }

  async loadPackages(packages: string[]): Promise<void> {
    if (!window.pyodide || !window.liteChatPython?.isReady) {
      throw new Error("Python environment not ready");
    }

    const newPackages = packages.filter(pkg => !this.loadedPackages.has(pkg));
    if (newPackages.length === 0) {
      return;
    }

    toast.info(`Loading packages: ${newPackages.join(', ')}...`);
    
    try {
      // Load packages using pyodide.loadPackage for better performance
      await window.pyodide.loadPackage(newPackages);
      
      // Mark packages as loaded
      newPackages.forEach(pkg => this.loadedPackages.add(pkg));
      window.liteChatPython!.loadedPackages = this.loadedPackages;
      
      toast.success(`Packages loaded: ${newPackages.join(', ')}`);
    } catch (error) {
      console.warn("Some packages failed to load via pyodide.loadPackage, trying micropip:", error);
      
      // Fallback to micropip for packages not in pyodide
      try {
        const micropip = window.pyodide.pyimport("micropip");
        for (const pkg of newPackages) {
          await micropip.install(pkg);
          this.loadedPackages.add(pkg);
        }
        window.liteChatPython!.loadedPackages = this.loadedPackages;
        toast.success(`Packages installed via micropip: ${newPackages.join(', ')}`);
      } catch (micropipError) {
        console.error("Failed to install packages:", micropipError);
        toast.error("Some packages failed to install. Code may not work correctly.");
        throw micropipError;
      }
    }
  }

  analyzeImports(code: string): string[] {
    const lines = code.split('\n');
    const requiredPackages = new Set<string>();
    
    const packageMap: Record<string, string> = {
      'numpy': 'numpy',
      'np': 'numpy',
      'matplotlib': 'matplotlib',
      'plt': 'matplotlib',
      'pandas': 'pandas',
      'pd': 'pandas',
      'scipy': 'scipy',
      'sklearn': 'scikit-learn',
      'cv2': 'opencv-python',
      'PIL': 'pillow',
      'requests': 'requests',
      'beautifulsoup4': 'beautifulsoup4',
      'bs4': 'beautifulsoup4',
      'sympy': 'sympy',
      'networkx': 'networkx',
      'plotly': 'plotly',
      'seaborn': 'seaborn',
      'statsmodels': 'statsmodels'
    };

    for (const line of lines) {
      const trimmed = line.trim();
      
      const importMatch = trimmed.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (importMatch) {
        const pkg = importMatch[1];
        if (packageMap[pkg]) {
          requiredPackages.add(packageMap[pkg]);
        }
      }
      
      const fromMatch = trimmed.match(/^from\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (fromMatch) {
        const pkg = fromMatch[1];
        if (packageMap[pkg]) {
          requiredPackages.add(packageMap[pkg]);
        }
      }
      
      const asMatch = trimmed.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (asMatch) {
        const pkg = asMatch[1];
        const alias = asMatch[2];
        if (packageMap[pkg]) {
          requiredPackages.add(packageMap[pkg]);
        }
        if (packageMap[alias]) {
          requiredPackages.add(packageMap[alias]);
        }
      }
    }
    
    return Array.from(requiredPackages);
  }

  /**
   * Disposes the GlobalPythonManager singleton and resets all related state.
   * Useful for cleanup, memory management, or testing.
   */
  static dispose(): void {
    if (GlobalPythonManager.instance) {
      GlobalPythonManager.instance.loadPromise = null;
      GlobalPythonManager.instance.loadedPackages.clear();
      GlobalPythonManager.instance = null as any;
    }
    if (window.liteChatPython) {
      window.liteChatPython.isLoading = false;
      window.liteChatPython.isReady = false;
      if (window.liteChatPython.loadedPackages && typeof window.liteChatPython.loadedPackages.clear === 'function') {
        window.liteChatPython.loadedPackages.clear();
      } else {
        window.liteChatPython.loadedPackages = new Set<string>();
      }
      window.liteChatPython.loadPromise = undefined;
    }
    // Optionally remove pyodide from window for full cleanup
    // delete window.pyodide;
    // delete window.loadPyodide;
  }
  
}

const PythonRunnableBlockRendererComponent: React.FC<PythonRunnableBlockRendererProps> = ({
  code,
  isStreaming = false,
  interactionId,
  blockId,
}) => {
  const { t } = useTranslation('renderers');
  
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
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [previewContentUpdated, setPreviewContentUpdated] = useState(0);

  // Security validation state
  const [securityResult, setSecurityResult] = useState<CodeSecurityResult | null>(null);
  const [isCheckingSecurity, setIsCheckingSecurity] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Get global Python manager
  const pythonManager = useMemo(() => GlobalPythonManager.getInstance(), []);

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
  const previewRef = useRef<HTMLDivElement>(null);

  // Listen for matplotlib content updates
  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const handleContentAdded = () => {
      setPreviewContentUpdated(prev => prev + 1);
    };

    previewElement.addEventListener('previewContentAdded', handleContentAdded);
    return () => {
      previewElement.removeEventListener('previewContentAdded', handleContentAdded);
    };
  }, []);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

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
      toast.error(t('pythonRunnableBlock.securityCheckFailed'));
    } finally {
      setIsCheckingSecurity(false);
    }
  }, [code, editedCode, isEditing]);

  const handleRunClick = useCallback(async () => {
    if (!runnableBlocksEnabled) {
      toast.error(t('pythonRunnableBlock.blocksDisabled'));
      return;
    }

    // Immediately set running state and disable button for instant feedback
    setIsRunning(true);

    // Ensure Python is loaded
    try {
      await pythonManager.ensurePythonLoaded();
    } catch (error) {
      setIsRunning(false); // Reset running state on error
      toast.error(t('pythonRunnableBlock.loadFailed'));
      return;
    }

    // Security check logic
    if (securityResult) {
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime;
      
      if (timeSinceLastClick > 3000) {
        setClickCount(0);
      }
      
      setLastClickTime(now);
      const newClickCount = clickCount + 1;
      setClickCount(newClickCount);

      if (newClickCount < securityResult.clicksRequired) {
        setIsRunning(false); // Reset running state if not enough clicks
        const remaining = securityResult.clicksRequired - newClickCount;
        toast.info(`Click ${remaining} more time${remaining > 1 ? 's' : ''} to confirm execution (Risk: ${securityResult.riskLevel})`);
        return;
      }

      if (securityResult.score > 90) {
        if (!confirm(`This code has a very high security risk score (${securityResult.score}/100). Are you absolutely sure you want to run it?`)) {
          setClickCount(0);
          setIsRunning(false); // Reset running state if user cancels
          return;
        }
      }

      setClickCount(0);
    }

    executeCode();
  }, [securityResult, clickCount, lastClickTime, runnableBlocksEnabled, pythonManager]);

  const executeCode = useCallback(async () => {
    if (!window.pyodide || !window.liteChatPython?.isReady) return;

    const capturedLogs: string[] = [];

    // Clear the preview target
    if (previewRef.current) {
      previewRef.current.innerHTML = '';
    }

    try {
      const codeToRun = isEditing ? editedCode : code;
      
      // Load required packages
      const requiredPackages = pythonManager.analyzeImports(codeToRun);
      if (requiredPackages.length > 0) {
        await pythonManager.loadPackages(requiredPackages);
      }
      
      // Always ensure matplotlib is properly configured if it's imported
      const hasMatplotlib = requiredPackages.includes('matplotlib') || codeToRun.includes('matplotlib') || codeToRun.includes('plt');
      if (hasMatplotlib) {
        // Make sure matplotlib package is loaded even if not caught by import analysis
        if (!window.liteChatPython?.loadedPackages.has('matplotlib')) {
          await pythonManager.loadPackages(['matplotlib']);
        }
      }

      // Setup matplotlib for this block if needed
      if (hasMatplotlib && previewRef.current) {
        // Set the official pyodide matplotlib target to the always-present preview element
        (document as any).pyodideMplTarget = previewRef.current;
        
        window.pyodide.runPython(`
# ALWAYS set up matplotlib for web display using Pyodide's official method
import matplotlib
import matplotlib.pyplot as plt
from js import document

# Configure matplotlib to use the target element set in document.pyodideMplTarget
# This is the official Pyodide way as documented in matplotlib-pyodide

# Configure matplotlib for web environments  
matplotlib.use('module://matplotlib_pyodide.wasm_backend')
plt.ioff()  # Turn off interactive mode

print("✓ Matplotlib configured for Pyodide with always-present target element")
        `);
      }

      // Setup context for this block
      const contextObj = {
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

      // Make context available in Python
      window.pyodide.globals.set("litechat", contextObj.litechat);
      window.pyodide.globals.set("target", contextObj.target);

      // Start output capture
      window.pyodide.runPython("_global_capture.start_capture()");
      
      // Execute the code
      try {
        await window.pyodide.runPython(codeToRun);
      } catch (error: any) {
        // Let the global exception handler deal with it
        console.error("Python execution error:", error);
      }

      // Stop capture and get output
      const [stdout, stderr] = window.pyodide.runPython("_global_capture.stop_capture()");

      // Process output
      if (stdout && stdout.trim()) {
        capturedLogs.push("=== PROGRAM OUTPUT ===");
        stdout.split('\n').forEach((line: string) => {
          if (line.trim()) {
            capturedLogs.push(line);
          }
        });
      }

      if (stderr && stderr.trim()) {
        capturedLogs.push("=== ERROR/DEBUG OUTPUT ===");
        stderr.split('\n').forEach((line: string) => {
          if (line.trim()) {
            if (line.includes("=== DETAILED ERROR INFORMATION ===")) {
              capturedLogs.push(`🔴 ${line}`);
            } else if (line.includes("Exception Type:")) {
              capturedLogs.push(`❌ ${line}`);
            } else if (line.includes("Exception Message:")) {
              capturedLogs.push(`💬 ${line}`);
            } else if (line.includes("=== FULL TRACEBACK ===")) {
              capturedLogs.push(`📍 ${line}`);
            } else {
              capturedLogs.push(`⚠️  ${line}`);
            }
          }
        });
      }

      if (capturedLogs.length === 0) {
        capturedLogs.push("✅ Code executed successfully (no output)");
      }

    } catch (error: any) {
      capturedLogs.push("=== CRITICAL EXECUTION ERROR ===");
      capturedLogs.push(`❌ JavaScript Error: ${error instanceof Error ? error.name : 'Unknown'}`);
      capturedLogs.push(`💬 Message: ${error instanceof Error ? error.message : String(error)}`);
      
      console.error('Python execution error details:', {
        error,
        code: isEditing ? editedCode : code,
        timestamp: new Date().toISOString()
      });
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

      if (capturedLogs.some(log => log.includes('❌') || log.includes('🔴'))) {
        toast.error("Python execution failed - check output for details");
      } else {
        toast.success("Python code executed successfully");
      }
    }
  }, [code, editedCode, isEditing, pythonManager]);

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

  const getRunButtonText = () => {
    if (isRunning) return t('pythonRunnableBlock.running');
    if (window.liteChatPython?.isLoading) return t('pythonRunnableBlock.loadingPython');
    if (!window.liteChatPython?.isReady) return t('pythonRunnableBlock.loadPython');
    if (securityResult && clickCount > 0 && clickCount < securityResult.clicksRequired) {
      return t('pythonRunnableBlock.clickMore', { count: securityResult.clicksRequired - clickCount });
    }
    return t('pythonRunnableBlock.run');
  };

  const hasPreviewContent = useMemo(() => {
    return hasRun && previewRef.current && (
      previewRef.current.children.length > 0 || 
      previewRef.current.innerHTML.trim().length > 0
    );
  }, [hasRun, previewContentUpdated]);

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">{t('pythonRunnableBlock.header')}</div>
          {window.liteChatPython?.isReady && (
            <div className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
{t('pythonRunnableBlock.ready', { count: window.liteChatPython.loadedPackages.size })}
            </div>
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
          <ActionTooltipButton
            tooltipText={securityResult ? t('pythonRunnableBlock.recheckSecurity') : t('pythonRunnableBlock.checkSecurity')}
            size="sm"
            variant="outline"
            onClick={checkSecurity}
            disabled={isCheckingSecurity}
            className="text-xs h-7"
            icon={
              isCheckingSecurity ? (
                <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ShieldCheckIcon className="h-3 w-3 mr-1" />
              )
            }
          />
          {hasRun && (
            <>
              <ActionTooltipButton
                tooltipText={t('pythonRunnableBlock.showCode')}
                size="sm"
                variant={!showOutput && !showPreview ? "default" : "outline"}
                onClick={toggleCode}
                className="text-xs h-7"
                icon={<CodeIcon className="h-3 w-3 mr-1" />}
              />
              <ActionTooltipButton
                tooltipText={t('pythonRunnableBlock.showConsole')}
                size="sm"
                variant={showOutput ? "default" : "outline"}
                onClick={toggleConsole}
                className="text-xs h-7"
                icon={<MonitorSpeakerIcon className="h-3 w-3 mr-1" />}
              />
              <ActionTooltipButton
                tooltipText={t('pythonRunnableBlock.showPreview')}
                size="sm"
                variant={showPreview ? "default" : "outline"}
                onClick={togglePreview}
                className="text-xs h-7"
                icon={<EyeIcon className="h-3 w-3 mr-1" />}
              />
            </>
          )}
          <Button
            size="sm"
            onClick={handleRunClick}
            disabled={isRunning || window.liteChatPython?.isLoading || !runnableBlocksEnabled}
            className={
              `text-xs h-7 ` +
              (securityResult
                ? securityResult.score > 90
                  ? 'bg-[hsl(var(--destructive))] border-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]'
                  : securityResult.score > 60
                  ? 'bg-[hsl(var(--accent))] border-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : securityResult.score > 30
                  ? 'bg-[hsl(var(--warning, var(--primary)))] border-[hsl(var(--warning, var(--primary)))] text-[hsl(var(--foreground))]'
                  : 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : '')
            }
          >
            {isRunning || window.liteChatPython?.isLoading ? (
              <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
            ) : !window.liteChatPython?.isReady ? (
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
{t('pythonRunnableBlock.output')}
          </div>
          {output.length > 0 ? (
            output.map((line, i) => {
              let className = 'text-green-400';
              let isHeader = false;
              
              if (line.includes('=== CRITICAL EXECUTION ERROR ===') || 
                  line.includes('=== EXECUTION ERROR DETAILS ===') ||
                  line.includes('=== DETAILED ERROR INFORMATION ===')) {
                className = 'text-red-300 font-bold border-b border-red-500/30 pb-1 mb-1';
                isHeader = true;
              } else if (line.includes('=== PROGRAM OUTPUT ===')) {
                className = 'text-blue-300 font-bold border-b border-blue-500/30 pb-1 mb-1';
                isHeader = true;
              } else if (line.includes('=== ERROR/DEBUG OUTPUT ===')) {
                className = 'text-yellow-300 font-bold border-b border-yellow-500/30 pb-1 mb-1';
                isHeader = true;
              } else if (line.startsWith('🔴')) {
                className = 'text-red-400 font-semibold';
              } else if (line.startsWith('📍')) {
                className = 'text-orange-400 font-semibold';
              } else if (line.startsWith('💡')) {
                className = 'text-cyan-400';
              } else if (line.startsWith('❌')) {
                className = 'text-red-400 font-medium';
              } else if (line.startsWith('💬')) {
                className = 'text-yellow-300 font-medium';
              } else if (line.startsWith('⚠️')) {
                className = 'text-yellow-400';
              } else if (line.startsWith('✅')) {
                className = 'text-green-300 font-medium';
              }
              
              return (
                <div 
                  key={i} 
                  className={`${className} ${isHeader ? 'my-2' : 'my-0.5'} leading-relaxed`}
                >
                  {line}
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground">{t('pythonRunnableBlock.noOutput')}</div>
          )}
        </div>
      )}

      {/* ALWAYS render preview element (hidden when not shown) so ref is always available */}
      <div ref={previewRef} className={!isFolded && showPreview ? "preview-container border border-border rounded-b-lg bg-background" : "hidden"}>
        {!isFolded && showPreview && (
          <>
            <div className="preview-header text-muted-foreground px-4 pt-4 pb-2 text-xs font-semibold">
{t('pythonRunnableBlock.preview')}
            </div>
            <div className="preview-content px-4 pb-4">
              {!hasPreviewContent && (
                <div className="min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-4 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm italic text-center">
                    {t('pythonRunnableBlock.noPreviewContent')}
                  </div>
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