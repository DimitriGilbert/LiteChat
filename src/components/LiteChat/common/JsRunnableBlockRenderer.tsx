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
import {
  PlayIcon,
  Loader2Icon,
  EyeIcon,
  CodeIcon,
  ShieldIcon,
  ShieldCheckIcon,
  MonitorSpeakerIcon,
  DownloadIcon,
  SquareIcon,
  RocketIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CodeSecurityService,
  type CodeSecurityResult,
} from "@/services/code-security.service";
import { ActionTooltipButton } from "./ActionTooltipButton";

// QuickJS types declaration
declare global {
  interface Window {
    getQuickJS?: () => Promise<any>;
    liteChatQuickJS?: {
      isLoading: boolean;
      isReady: boolean;
      loadPromise?: Promise<void>;
      QuickJS?: any;
      context?: any;
    };
  }
}

interface JsRunnableBlockRendererProps {
  code: string;
  isStreaming?: boolean;
  interactionId?: string;
  blockId?: string;
  module?: any;
}

// QuickJS loader utility
const waitForQuickJS = () => {
  if (window.liteChatQuickJS?.isReady && window.liteChatQuickJS.QuickJS && window.liteChatQuickJS.context) {
    return Promise.resolve({ QuickJS: window.liteChatQuickJS.QuickJS, vm: window.liteChatQuickJS.context });
  }
  return new Promise<{ QuickJS: any; vm: any }>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    function cleanup() {
      window.removeEventListener('quickjs-ready', onReady);
      window.removeEventListener('quickjs-error', onError);
      if (timeoutId) clearTimeout(timeoutId);
    }
    
    function onReady(e: any) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(e.detail);
    }
    
    function onError(e: any) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e.detail);
    }
    
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Timed out waiting for QuickJS to load'));
    }, 10000);
    
    window.addEventListener('quickjs-ready', onReady);
    window.addEventListener('quickjs-error', onError);
    window.dispatchEvent(new Event('get-quickjs'));
  });
};

const JsRunnableBlockRendererComponent: React.FC<JsRunnableBlockRendererProps> = ({ 
  code, 
  isStreaming = false, 
  interactionId, 
  blockId, 
  module 
}) => {
  // Settings
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );
  const runnableBlocksEnabled = useSettingsStore(useShallow((state) => state.runnableBlocksEnabled));

  // Core state
  const [isFolded, setIsFolded] = useState(isStreaming ? foldStreamingCodeBlocks : false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Security validation state
  const [securityResult, setSecurityResult] = useState<CodeSecurityResult | null>(null);
  const [isCheckingSecurity, setIsCheckingSecurity] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Execution mode - Safe by default
  const [useSafeMode, setUseSafeMode] = useState(true);
  
  // Unique ID for this block
  const blockUniqueId = useMemo(() => blockId || `js-block-${Math.random().toString(36).substr(2, 9)}`, [blockId]);

  // QuickJS status tracking
  const [quickjsStatus, setQuickjsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(() => {
    if (typeof window !== 'undefined' && window.liteChatQuickJS) {
      if (window.liteChatQuickJS.isReady) return 'ready';
      if (window.liteChatQuickJS.isLoading) return 'loading';
      return 'idle';
    }
    return 'idle';
  });

  // Refs
  const codeRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // Canvas controls integration
  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  // Keep quickjsStatus in sync with global state
  useEffect(() => {
    function updateStatusFromGlobal() {
      if (window.liteChatQuickJS?.isReady) setQuickjsStatus('ready');
      else if (window.liteChatQuickJS?.isLoading) setQuickjsStatus('loading');
      else setQuickjsStatus('idle');
    }
    
    function onReady() {
      setQuickjsStatus('ready');
    }
    
    function onError() {
      setQuickjsStatus('error');
    }
    
    window.addEventListener('quickjs-ready', onReady);
    window.addEventListener('quickjs-error', onError);
    updateStatusFromGlobal();
    
    return () => {
      window.removeEventListener('quickjs-ready', onReady);
      window.removeEventListener('quickjs-error', onError);
    };
  }, []);

  // Update edited code when original code changes
  useEffect(() => {
    if (!isEditing) {
      setEditedCode(code);
    }
  }, [code, isEditing]);

  // Move preview target to correct position based on preview visibility
  useEffect(() => {
    if (previewRef.current && previewContentRef.current) {
      if (!isFolded && showPreview) {
        // Move target into preview content area
        if (previewRef.current.parentNode !== previewContentRef.current) {
          previewContentRef.current.appendChild(previewRef.current);
        }
        // Reset positioning for normal flow
        previewRef.current.style.position = 'relative';
        previewRef.current.style.top = '0';
        previewRef.current.style.left = '0';
        previewRef.current.style.width = '100%';
        previewRef.current.style.height = '100%';
        previewRef.current.style.visibility = 'visible';
        previewRef.current.style.pointerEvents = 'auto';
        previewRef.current.style.zIndex = '1';
      } else {
        // Move target to hidden position
        if (previewRef.current.parentNode === previewContentRef.current) {
          document.body.appendChild(previewRef.current);
        }
        // Hide the target
        previewRef.current.style.position = 'absolute';
        previewRef.current.style.top = '-9999px';
        previewRef.current.style.left = '-9999px';
        previewRef.current.style.width = '1px';
        previewRef.current.style.height = '1px';
        previewRef.current.style.visibility = 'hidden';
        previewRef.current.style.pointerEvents = 'none';
        previewRef.current.style.zIndex = '-1';
      }
    }
  }, [showPreview, isFolded]);

  // Reset security state when code changes
  useEffect(() => {
    setSecurityResult(null);
    setClickCount(0);
    setLastClickTime(0);
  }, [editedCode]);

  // Canvas controls renderer
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
    [canvasControls, editedCode, interactionId, blockId, setIsEditing]
  );

  // Code highlighting
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

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        try {
          // Simple cleanup during unmount
          previewRef.current.innerHTML = "";
        } catch (error) {
          // Ignore cleanup errors during unmount - component is going away anyway
        }
      }
    };
  }, []);

  // Folding
  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding) {
      setTimeout(highlightCode, 0);
    }
  };

  // Security check
  const checkSecurity = useCallback(async () => {
    setIsCheckingSecurity(true);
    try {
      const codeToCheck = isEditing ? editedCode : code;
      const result = await CodeSecurityService.validateCodeSecurity(codeToCheck, "javascript");
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

  // CLEAN QUICKJS SAFE MODE EXECUTION
  const executeSafeMode = useCallback(async (codeToRun: string, capturedLogs: string[]) => {
    const quickjsVm = window.liteChatQuickJS!.context;
    
    try {
      // Create litechat object
      const litechatObj = quickjsVm.newObject();
      
      // Utils object with log function
      const utilsObj = quickjsVm.newObject();
      const logFn = quickjsVm.newFunction('log', (...args: any[]) => {
        const jsArgs = args.map((arg) => quickjsVm.dump(arg));
        capturedLogs.push(jsArgs.join(' '));
        return quickjsVm.undefined;
      });
      quickjsVm.setProp(utilsObj, 'log', logFn);
      quickjsVm.setProp(litechatObj, 'utils', utilsObj);

      // Toast function
      const toastFn = quickjsVm.newFunction('toast', (msg: any) => {
        const message = quickjsVm.dump(msg);
        toast(message);
        return quickjsVm.undefined;
      });
      quickjsVm.setProp(litechatObj, 'toast', toastFn);

      // DOM Bridge - Simple but complete
      const nodeMap = new Map<string, Node>();
      let nodeIdCounter = 1;

      const genNodeId = () => `qjsnode_${nodeIdCounter++}`;

      // Get root element ID
      const getRootIdFn = quickjsVm.newFunction("__getRootId", () => {
        let id = (previewRef.current as any).__qjs_id;
        if (!id) {
          id = genNodeId();
          (previewRef.current as any).__qjs_id = id;
          nodeMap.set(id, previewRef.current!);
        }
        return quickjsVm.newString(id);
      });
      quickjsVm.setProp(quickjsVm.global, "__getRootId", getRootIdFn);

      // Create element
      const createElementFn = quickjsVm.newFunction("__createElement", (tag: any) => {
        const tagName = quickjsVm.dump(tag);
        const el = document.createElement(tagName);
        const id = genNodeId();
        (el as any).__qjs_id = id;
        nodeMap.set(id, el);
        return quickjsVm.newString(id);
      });
      quickjsVm.setProp(quickjsVm.global, "__createElement", createElementFn);

      // Append child
      const appendChildFn = quickjsVm.newFunction("__appendChild", (parentId: any, childId: any) => {
        const parent = nodeMap.get(quickjsVm.dump(parentId));
        const child = nodeMap.get(quickjsVm.dump(childId));
        if (parent && child) {
          parent.appendChild(child);
        }
        return quickjsVm.undefined;
      });
      quickjsVm.setProp(quickjsVm.global, "__appendChild", appendChildFn);

      // Set text content
      const setTextContentFn = quickjsVm.newFunction("__setTextContent", (id: any, value: any) => {
        const node = nodeMap.get(quickjsVm.dump(id));
        if (node) {
          (node as any).textContent = quickjsVm.dump(value);
        }
        return quickjsVm.undefined;
      });
      quickjsVm.setProp(quickjsVm.global, "__setTextContent", setTextContentFn);

      // Set innerHTML
      const setInnerHTMLFn = quickjsVm.newFunction("__setInnerHTML", (id: any, value: any) => {
        const node = nodeMap.get(quickjsVm.dump(id));
        if (node && node instanceof Element) {
          node.innerHTML = quickjsVm.dump(value);
        }
        return quickjsVm.undefined;
      });
      quickjsVm.setProp(quickjsVm.global, "__setInnerHTML", setInnerHTMLFn);

      // Set style
      const setStyleFn = quickjsVm.newFunction("__setStyle", (id: any, property: any, value: any) => {
        const node = nodeMap.get(quickjsVm.dump(id));
        if (node && node instanceof HTMLElement) {
          (node.style as any)[quickjsVm.dump(property)] = quickjsVm.dump(value);
        }
        return quickjsVm.undefined;
      });
      quickjsVm.setProp(quickjsVm.global, "__setStyle", setStyleFn);

      // Set litechat global
      quickjsVm.setProp(quickjsVm.global, 'litechat', litechatObj);

      // Virtual DOM API for easier use
      const vdomApi = `
        function QNode(id) { this.__id = id; }
        QNode.prototype.appendChild = function(child) { __appendChild(this.__id, child.__id); return this; };
        QNode.prototype.setStyle = function(property, value) { __setStyle(this.__id, property, value); return this; };
        Object.defineProperty(QNode.prototype, 'textContent', {
          set: function(value) { __setTextContent(this.__id, value); }
        });
        Object.defineProperty(QNode.prototype, 'innerHTML', {
          set: function(value) { __setInnerHTML(this.__id, value); }
        });
        
        function createElement(tag) { return new QNode(__createElement(tag)); }
        function getRoot() { return new QNode(__getRootId()); }
        
        // Console API
        const console = {
          log: (...args) => litechat.utils.log(...args)
        };
      `;

      // Execute virtual DOM API setup
      const apiResult = quickjsVm.evalCode(vdomApi);
      if (apiResult.error) {
        console.error('API setup error:', quickjsVm.dump(apiResult.error));
        apiResult.error.dispose();
      } else {
        apiResult.value.dispose();
      }

      // Execute user code
      const result = quickjsVm.evalCode(codeToRun);
      if (result.error) {
        const errorMsg = quickjsVm.dump(result.error);
        capturedLogs.push(`QuickJS Error: ${errorMsg}`);
        result.error.dispose();
      } else {
        result.value.dispose();
        if (capturedLogs.length === 0) {
          capturedLogs.push("Code executed successfully in safe mode");
        }
      }

      // Cleanup
      [logFn, toastFn, getRootIdFn, createElementFn, appendChildFn, setTextContentFn, setInnerHTMLFn, setStyleFn].forEach(fn => fn.dispose());
      [litechatObj, utilsObj].forEach(obj => obj.dispose());

    } catch (error) {
      capturedLogs.push(`Safe execution error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  // CLEAN UNSAFE MODE EXECUTION - NO CONSOLE OVERRIDE!
  const executeUnsafeMode = useCallback(async (codeToRun: string, capturedLogs: string[]) => {
    try {
      // Create clean execution context WITHOUT touching console
      let contextObj: any = {};
      if (module && module.getEnhancedContext) {
        contextObj = module.getEnhancedContext(capturedLogs, previewRef.current);
        // Ensure the enhanced context has all required utils functions
        if (contextObj.litechat && contextObj.litechat.utils) {
          contextObj.litechat.utils.error = contextObj.litechat.utils.error || console.error;
          contextObj.litechat.utils.warn = contextObj.litechat.utils.warn || console.warn;
          contextObj.litechat.utils.log = contextObj.litechat.utils.log || console.log;
          contextObj.litechat.utils.toast = contextObj.litechat.utils.toast || ((message: string) => toast(message));
        }
      } else {
        contextObj = {
          litechat: {
            utils: { 
              log: (...args: any[]) => {
                const formatted = args.map(arg => 
                  typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                ).join(" ");
                capturedLogs.push(formatted);
                console.log(...args);
              },
              toast: (message: string) => toast(message), 
              error: (...args: any[]) => {
                const formatted = args.map(arg => 
                  typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                ).join(" ");
                capturedLogs.push(`Error: ${formatted}`);
                console.error(...args);
              },
              warn: (...args: any[]) => {
                const formatted = args.map(arg => 
                  typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                ).join(" ");
                capturedLogs.push(`Warning: ${formatted}`);
                console.warn(...args);
              }
            },
            target: previewRef.current || document.createElement('div'),
          },
        };
      }

      // Make litechat globally available
      const originalLiteChat = (window as any).litechat;
      (window as any).litechat = contextObj.litechat;

      // Execute code directly with eval - PURE UNSAFE MODE
      const wrappedCode = `
        (async () => { 
          const litechat = window.litechat;
          console.log('litechat.target in execution context:', litechat.target);
          ${codeToRun} 
        })()
      `;
      
      const result = eval(wrappedCode);
      if (result && typeof result.then === "function") {
        await result;
      }

      if (capturedLogs.length === 0) {
        capturedLogs.push("Code executed successfully in unsafe mode - use litechat.utils.log() for captured output");
      }

      // Restore global litechat
      if (originalLiteChat !== undefined) {
        (window as any).litechat = originalLiteChat;
      } else {
        delete (window as any).litechat;
      }

    } catch (error) {
      capturedLogs.push(`Execution Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [module]);

  // Main execution function
  const executeCode = useCallback(async () => {
    if (useSafeMode && (!window.liteChatQuickJS?.isReady || !window.liteChatQuickJS.context)) {
      toast.error('Safe execution environment not ready. Please try again.');
      setIsRunning(false);
      return;
    }

    const capturedLogs: string[] = [];
    
    // Clear preview safely - ensure target exists
    if (previewRef.current) {
      try {
        // Simple innerHTML clear - safer than removeChild
        previewRef.current.innerHTML = "";
      } catch (error) {
        console.warn('Preview cleanup failed:', error);
        // Target is probably corrupted, just ignore and continue
      }
    }

    const codeToRun = isEditing ? editedCode : code;

    try {
      if (useSafeMode) {
        await executeSafeMode(codeToRun, capturedLogs);
      } else {
        await executeUnsafeMode(codeToRun, capturedLogs);
      }
    } catch (error) {
      capturedLogs.push(`Execution Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOutput(capturedLogs);
      setHasRun(true);
      setIsRunning(false);

      // Always show preview first in unsafe mode, then check for content
      if (!useSafeMode) {
        // Force preview mode immediately for unsafe execution
        setShowPreview(true);
        setShowOutput(false);
        
        // Check for content after a brief delay to allow DOM manipulation
        setTimeout(() => {
          const hasPreviewContent = previewRef.current && 
            (previewRef.current.children.length > 0 || previewRef.current.innerHTML.trim().length > 0);
          
          // Only switch to console if there's truly no preview content AND there are logs
          if (!hasPreviewContent && capturedLogs.length > 0) {
            setShowOutput(true);
            setShowPreview(false);
          }
        }, 200); // Increased delay to allow for async operations
      } else {
        // Safe mode - check content immediately
        const hasPreviewContent = previewRef.current && 
          (previewRef.current.children.length > 0 || previewRef.current.innerHTML.trim().length > 0);
        
        if (hasPreviewContent) {
          setShowPreview(true);
          setShowOutput(false);
        } else {
          setShowOutput(true);
          setShowPreview(false);
        }
      }

      // Show result toast
      if (capturedLogs.some((log) => log.includes("Error:"))) {
        toast.error("Code execution failed - check output for details");
      } else {
        toast.success(`Code executed successfully ${useSafeMode ? "(safe mode)" : "(unsafe mode)"}`);
      }
    }
  }, [code, editedCode, isEditing, useSafeMode, executeSafeMode, executeUnsafeMode]);

  // Click handler with security validation
  const handleRunClick = useCallback(async () => {
    if (!runnableBlocksEnabled) {
      toast.error('Runnable blocks are disabled in settings.');
      return;
    }

    // Multi-click security confirmation
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
        const remaining = securityResult.clicksRequired - newClickCount;
        toast.info(`Click ${remaining} more time${remaining > 1 ? 's' : ''} to confirm execution (Risk: ${securityResult.riskLevel})`);
        return;
      }
      
      if (securityResult.score > 90) {
        if (!window.confirm(`This code has a very high security risk score (${securityResult.score}/100). Are you absolutely sure you want to run it?`)) {
          setClickCount(0);
          return;
        }
      }
      
      setClickCount(0);
    }

    setIsRunning(true);
    
    if (useSafeMode) {
      if (!window.liteChatQuickJS?.isReady || !window.liteChatQuickJS.context) {
        try {
          await waitForQuickJS();
        } catch {
          setIsRunning(false);
          return;
        }
      }
    }
    
    executeCode();
  }, [runnableBlocksEnabled, useSafeMode, executeCode, securityResult, clickCount, lastClickTime]);

  // View toggles
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

  // Utilities
  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code.split("\n").slice(0, 3).join("\n");
  }, [code]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    isEditing ? editedCode : code,
    "javascript",
    undefined,
    isFolded,
    toggleFold
  );

  const getRunButtonText = () => {
    if (isRunning) return "Running...";
    if (quickjsStatus === 'loading') return "Loading...";
    if (useSafeMode && quickjsStatus !== 'ready') return "Run";
    if (securityResult && clickCount > 0 && clickCount < securityResult.clicksRequired) {
      return `Click ${securityResult.clicksRequired - clickCount} more`;
    }
    return "Run";
  };

  // Stop/Clear function
  const handleStop = useCallback(() => {
    // Clear preview content
    if (previewRef.current) {
      previewRef.current.innerHTML = '';
    }
    
    // Clear output
    setOutput([]);
    setHasRun(false);
    
    // Reset view to code
    setShowOutput(false);
    setShowPreview(false);
    
    // Try to clean up any loaded modules (best effort)
    try {
      // Remove any script tags that might have been added
      const scripts = document.querySelectorAll('script[src*="unpkg.com"], script[src*="jsdelivr.net"], script[src*="cdnjs.cloudflare.com"]');
      scripts.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
      
      // Clear any global modules that might have been set
      ['THREE', 'OrbitControls', 'D3', 'moment', 'lodash'].forEach(moduleName => {
        if ((window as any)[moduleName]) {
          delete (window as any)[moduleName];
        }
      });
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
    
    toast.success('Preview cleared and modules unloaded');
  }, []);

  // Download executable function
  const handleDownloadExecutable = useCallback(() => {
    const codeToDownload = isEditing ? editedCode : code;
    
    if (!codeToDownload.trim()) {
      toast.error('No code to download');
      return;
    }

    // Create the self-contained HTML file
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiteChat JS Executable</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(90deg, #4f46e5, #7c3aed);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 20px;
            min-height: 400px;
        }
        .footer {
            background: #f8fafc;
            padding: 15px 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }
        #litechat-target {
            width: 100%;
            min-height: 300px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="text-2xl font-bold mb-2">🚀 LiteChat JS Executable</h1>
            <p class="text-blue-100">Generated from LiteChat Runnable JavaScript Block</p>
        </div>
        <div class="content">
            <div id="litechat-target"></div>
        </div>
        <div class="footer">
            Generated by <strong>LiteChat</strong> • Visit <a href="https://litechat.dbuild.dev" class="text-blue-600 hover:underline">litechat.dbuild.dev</a>
        </div>
    </div>

    <script type="module">
        // LiteChat API Implementation
        const litechatTarget = document.getElementById('litechat-target');
        const capturedLogs = [];

        // Enhanced module loading with import map support
        async function loadModule(moduleUrl, moduleName, globalKey, importMap) {
            const key = globalKey || moduleName;
            // Check if already loaded
            if (window[key]) {
                return window[key];
            }

            try {
                // Setup import map if provided
                if (importMap) {
                    // Remove any existing import map first
                    const existingMap = document.querySelector('script[type="importmap"]');
                    if (existingMap) {
                        existingMap.remove();
                    }

                    const mapScript = document.createElement('script');
                    mapScript.type = 'importmap';
                    mapScript.textContent = JSON.stringify({ imports: importMap });
                    document.head.appendChild(mapScript);

                    // Wait for the import map to be processed
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Dynamic import
                const module = await import(moduleUrl);
                window[key] = module;

                // Dispatch ready event
                window.dispatchEvent(new CustomEvent(\`\${moduleName.toLowerCase()}-ready\`, {
                    detail: { [moduleName]: module }
                }));

                return module;
            } catch (error) {
                console.error(\`Error loading module \${moduleName}:\`, error);
                window.dispatchEvent(new CustomEvent(\`\${moduleName.toLowerCase()}-error\`, {
                    detail: error
                }));
                throw error;
            }
        }

        // Enhanced loadModules function
        async function loadModules(moduleConfigs) {
            const loadedModules = {};
            const loadPromises = {};

            // 1. Merge all import maps from module configs
            const globalImportMap = {};
            moduleConfigs.forEach(config => {
                if (config.importMap) {
                    Object.assign(globalImportMap, config.importMap);
                }
            });

            // 2. Remove any existing import map
            const existingMap = document.querySelector('script[type="importmap"]');
            if (existingMap) existingMap.remove();

            // 3. Inject the new import map
            if (Object.keys(globalImportMap).length > 0) {
                const mapScript = document.createElement('script');
                mapScript.type = 'importmap';
                mapScript.textContent = JSON.stringify({ imports: globalImportMap });
                document.head.appendChild(mapScript);

                // 4. Wait for the import map to be processed
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 5. Helper function to load a single module
            const loadSingleModule = async (config) => {
                const key = config.globalKey || config.name;
                if (window[key]) return window[key];
                if (key in loadPromises) return loadPromises[key];

                // Wait for dependencies first
                if (config.dependencies) {
                    await Promise.all(config.dependencies.map(depKey => {
                        const depModule = moduleConfigs.find(m => (m.globalKey || m.name) === depKey);
                        if (depModule) return loadSingleModule(depModule);
                        return Promise.resolve();
                    }));
                }

                // Load the module
                loadPromises[key] = (async () => {
                    try {
                        const module = await import(config.url);
                        window[key] = module;
                        loadedModules[key] = module;
                        return module;
                    } catch (error) {
                        console.error(\`Error loading module \${config.name}:\`, error);
                        throw error;
                    }
                })();

                return loadPromises[key];
            };

            // 6. Load all modules
            await Promise.all(moduleConfigs.map(config => loadSingleModule(config)));

            return loadedModules;
        }

        // Load script function
        async function loadScript(src) {
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if ([...document.scripts].some(s => s.src === src)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = (e) => {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    reject(new Error(\`Failed to load script: \${src} - \${errorMessage}\`));
                };
                document.head.appendChild(script);
            });
        }

        // Toast function (simple alert fallback)
        function showToast(message) {
            // Create a simple toast notification
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }

        // LiteChat API object
        window.litechat = {
            utils: {
                log: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    capturedLogs.push(formatted);
                    console.log(...args);
                },
                toast: showToast,
                error: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    capturedLogs.push(\`Error: \${formatted}\`);
                    console.error(...args);
                },
                warn: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    capturedLogs.push(\`Warning: \${formatted}\`);
                    console.warn(...args);
                },
                loadModule,
                loadModules,
                loadScript
            },
            target: litechatTarget,
            emit: (eventName, payload) => {
                window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
            }
        };

        // Execute the user's code after page load
        window.addEventListener('load', async () => {
            try {
                // User's code will be inserted here
                ${codeToDownload}
            } catch (error) {
                console.error('Execution error:', error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
                errorDiv.textContent = \`Error: \${error.message}\`;
                litechatTarget.appendChild(errorDiv);
            }
        });
    </script>
</body>
</html>`;

    // Create and download the file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'litechat-executable.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Executable HTML file downloaded successfully!');
  }, [code, editedCode, isEditing]);

  // State for tracking preview content
  const [hasPreviewContent, setHasPreviewContent] = useState(false);

  // Check for preview content whenever preview is shown
  useEffect(() => {
    if (showPreview && previewRef.current) {
      const checkContent = () => {
        const hasContent = previewRef.current ? 
          (previewRef.current.children.length > 0 || previewRef.current.innerHTML.trim().length > 0) : false;
        setHasPreviewContent(hasContent);
      };

      // Check immediately
      checkContent();

      // Set up a MutationObserver to watch for changes in the preview target
      const observer = new MutationObserver(checkContent);
      observer.observe(previewRef.current, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: true
      });

      return () => observer.disconnect();
    } else {
      setHasPreviewContent(false);
    }
  }, [showPreview, hasRun]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    // Make sure the div is focusable
    el.tabIndex = 0;

    // Handler to prevent default for navigation keys
    const preventKeys = (e: KeyboardEvent) => {
      // Only block if this element is focused
      if (document.activeElement !== el) return;
      const keys = [
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
        " ", // Space
        "Tab", // Optional: Tab
        "PageUp", "PageDown", "Home", "End"
      ];
      if (keys.includes(e.key)) {
        e.preventDefault();
        // Optionally: e.stopPropagation();
      }
    };

    // On focus, add listener
    const onFocus = () => window.addEventListener("keydown", preventKeys, { capture: true });
    // On blur, remove listener
    const onBlur = () => window.removeEventListener("keydown", preventKeys, { capture: true });

    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);

    // Clean up
    return () => {
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", preventKeys, { capture: true });
    };
  }, [previewRef]);

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      {/* Header */}
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">RUN JS</div>
          
          {/* QuickJS Status */}
          {quickjsStatus === 'ready' && (
            <div className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
              QuickJS Ready
            </div>
          )}
          {quickjsStatus === 'loading' && (
            <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
              QuickJS Loading
            </div>
          )}
          {quickjsStatus === 'error' && (
            <div className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
              QuickJS Error
            </div>
          )}
          
          {/* Mode indicator */}
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            useSafeMode ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
          }`}>
            {useSafeMode ? "SAFE" : "UNSAFE"}
          </span>
          
          {/* Security result */}
          {securityResult && (
            <div className="flex items-center gap-1 text-xs" style={{ color: securityResult.color }}>
              <ShieldIcon className="h-3 w-3" />
              <span>{securityResult.score}/100 ({securityResult.riskLevel})</span>
            </div>
          )}
          
          {/* Canvas controls */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Safe/Unsafe toggle */}
          <div className="flex items-center gap-2">
            <Label htmlFor={`safe-mode-toggle-${blockUniqueId}`} className="text-xs">
              {useSafeMode ? "Safe" : "Unsafe"}
            </Label>
            <Switch
              id={`safe-mode-toggle-${blockUniqueId}`}
              checked={useSafeMode}
              onCheckedChange={setUseSafeMode}
              className="scale-75"
            />
          </div>
          
          {/* Security check button */}
          <ActionTooltipButton
            tooltipText={securityResult ? "Recheck Security" : "Check Security"}
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
          
          {/* Download executable button */}
          <ActionTooltipButton
            tooltipText="Download executable"
            onClick={handleDownloadExecutable}
            className="text-xs h-7"
            icon={<RocketIcon className="h-3 w-3 mr-1" />}
          />
          
          {/* View toggles - only show after run */}
          {hasRun && (
            <>
              <ActionTooltipButton
                tooltipText="Show Code"
                onClick={toggleCode}
                className="text-xs h-7"
                icon={<CodeIcon className="h-3 w-3 mr-1" />}
              />
              <ActionTooltipButton
                tooltipText="Show Console"
                onClick={toggleConsole}
                className="text-xs h-7"
                icon={<MonitorSpeakerIcon className="h-3 w-3 mr-1" />}
              />
              <ActionTooltipButton
                tooltipText="Show Preview"
                onClick={togglePreview}
                className="text-xs h-7"
                icon={<EyeIcon className="h-3 w-3 mr-1" />}
              />
              <ActionTooltipButton
                tooltipText="Stop & Clear"
                onClick={handleStop}
                className="text-xs h-7"
                icon={<SquareIcon className="h-3 w-3 mr-1" />}
              />
            </>
          )}
          
          {/* Run button */}
          <Button
            size="sm"
            onClick={handleRunClick}
            disabled={isRunning || quickjsStatus === 'loading' || !runnableBlocksEnabled}
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
            {isRunning || quickjsStatus === 'loading' ? (
              <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
            ) : quickjsStatus !== 'ready' && useSafeMode ? (
              <DownloadIcon className="h-3 w-3 mr-1" />
            ) : (
              <PlayIcon className="h-3 w-3 mr-1" />
            )}
            {getRunButtonText()}
          </Button>
        </div>
      </div>

      {/* Code view - when not folded, not showing output/preview, and not editing */}
      {!isFolded && !showOutput && !showPreview && !isEditing && (
        <div className="overflow-hidden w-full">
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20">
            <code
              ref={codeRef}
              className="language-javascript block p-4 font-mono text-sm leading-relaxed"
            />
          </pre>
        </div>
      )}

      {/* Editing view */}
      {!isFolded && !showOutput && !showPreview && isEditing && (
        <div className="overflow-hidden w-full border border-border rounded-b-lg bg-muted/20">
          <InlineCodeEditor
            code={editedCode}
            language="javascript"
            onChange={setEditedCode}
          />
        </div>
      )}

      {/* Console output */}
      {!isFolded && showOutput && (
        <div className="output-container border border-border rounded-b-lg bg-black/90 text-green-400 p-4 font-mono text-sm">
          <div className="output-header text-green-300 mb-2 text-xs font-semibold">
            CONSOLE OUTPUT:
          </div>
          {output.length > 0 ? (
            output.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("Execution Error:") || line.startsWith("Error:")
                    ? "text-red-400"
                    : line.startsWith("Warning:")
                    ? "text-yellow-400"
                    : "text-green-400"
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

      {/* Preview Container with embedded target */}
      <div
        className={
          !isFolded && showPreview
            ? "preview-container border border-border rounded-b-lg bg-background p-4"
            : "preview-container-hidden"
        }
        style={{ 
          display: (!isFolded && showPreview) ? "block" : "none",
          minHeight: (!isFolded && showPreview) ? "100px" : "0"
        }}
        suppressHydrationWarning={true}
        key={`preview-${blockUniqueId}`}
      >
        {!isFolded && showPreview && (
          <>
            <div className="preview-header text-muted-foreground mb-2 text-xs font-semibold">
              PREVIEW:
            </div>
            <div 
              ref={previewContentRef}
              className="preview-content min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-2 relative"
              id={`preview-content-${blockUniqueId}`}
            >
              {!hasPreviewContent && (
                <div className="text-muted-foreground text-sm italic absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  No preview content. Use DOM manipulation or <code>litechat.target</code> to add elements here.
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* ALWAYS-MOUNTED PREVIEW TARGET - Initially hidden, moved by useEffect */}
      <div
        ref={previewRef}
        className="unsafe-code-target"
        style={{ 
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          width: "1px",
          height: "1px",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: "-1"
        }}
        suppressHydrationWarning={true}
      />

      {/* Folded view */}
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