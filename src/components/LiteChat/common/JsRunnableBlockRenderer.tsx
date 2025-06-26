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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CodeSecurityService,
  type CodeSecurityResult,
} from "@/services/code-security.service";

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

// Global QuickJS environment manager
// class GlobalQuickJSManager {
//   private static instance: GlobalQuickJSManager;
//   private loadPromise: Promise<void> | null = null;

//   static getInstance(): GlobalQuickJSManager {
//     if (!GlobalQuickJSManager.instance) {
//       GlobalQuickJSManager.instance = new GlobalQuickJSManager();
//     }
//     return GlobalQuickJSManager.instance;
//   }

//   async ensureQuickJSLoaded(): Promise<void> {
//     // Initialize window.liteChatQuickJS if not exists
//     if (!window.liteChatQuickJS) {
//       window.liteChatQuickJS = {
//         isLoading: false,
//         isReady: false,
//       };
//     }

//     // If already ready, return immediately
//     if (window.liteChatQuickJS.isReady && window.liteChatQuickJS.QuickJS) {
//       return;
//     }

//     // If already loading, wait for that promise
//     if (this.loadPromise) {
//       return this.loadPromise;
//     }

//     // Start loading
//     window.liteChatQuickJS.isLoading = true;
//     this.loadPromise = this.loadQuickJS();
//     return this.loadPromise;
//   }

//   private async loadQuickJS(): Promise<void> {
//     try {
//       // Load QuickJS from CDN if not already loaded
//       if (!window.getQuickJS) {
//         await this.loadQuickJSScript();
//       }

//       // Initialize QuickJS
//       const QuickJS = await window.getQuickJS!();
//       const context = QuickJS.newContext();

//       // Store in global state
//       window.liteChatQuickJS!.QuickJS = QuickJS;
//       window.liteChatQuickJS!.context = context;
//       window.liteChatQuickJS!.isReady = true;
//       window.liteChatQuickJS!.isLoading = false;

//       toast.success("QuickJS environment ready for all blocks!");
//     } catch (error) {
//       window.liteChatQuickJS!.isLoading = false;
//       window.liteChatQuickJS!.isReady = false;
//       this.loadPromise = null; // Reset load promise on failure
//       console.error("Failed to load QuickJS:", error);
//       toast.error("Failed to load QuickJS environment");
//       throw error;
//     }
//   }

//   private loadQuickJSScript(): Promise<void> {
//     return new Promise((resolve, reject) => {
//       // Create script element for QuickJS
//       const script = document.createElement("script");
//       script.src = "https://cdn.jsdelivr.net/npm/quickjs-emscripten@0.31.0/dist/index.js";
//       script.type = "module";
      
//       script.onload = () => {
//         console.log("[QuickJS Loader] Script loaded successfully");
        
//         // The CDN version should expose getQuickJS globally
//         if (window.getQuickJS) {
//           resolve();
//         } else {
//           // Fallback: try to load as ES module
//           this.loadQuickJSESModule().then(resolve).catch(reject);
//         }
//       };
      
//       script.onerror = () => {
//         console.error("[QuickJS Loader] Failed to load script, trying ES module");
//         // Fallback to ES module approach
//         this.loadQuickJSESModule().then(resolve).catch(reject);
//       };
      
//       document.head.appendChild(script);
//     });
//   }

//   private loadQuickJSESModule(): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const script = document.createElement("script");
//       script.type = "module";
//       script.textContent = `
//         console.log('[QuickJS ESM Loader] Loading...');
//         try {
//           const { getQuickJS } = await import("https://cdn.jsdelivr.net/npm/quickjs-emscripten@0.31.0/+esm");
//           window.getQuickJS = getQuickJS;
//           window.dispatchEvent(new Event('quickjs-ready'));
//           console.log('[QuickJS ESM Loader] Successfully loaded');
//         } catch (error) {
//           console.error('[QuickJS ESM Loader] Failed:', error);
//           window.dispatchEvent(new CustomEvent('quickjs-error', { detail: error }));
//         }
//       `;

//       const handleReady = () => {
//         window.removeEventListener("quickjs-ready", handleReady);
//         window.removeEventListener("quickjs-error", handleError);
//         resolve();
//       };

//       const handleError = (event: any) => {
//         window.removeEventListener("quickjs-ready", handleReady);
//         window.removeEventListener("quickjs-error", handleError);
//         reject(new Error("Failed to load QuickJS ESM module: " + event.detail));
//       };

//       window.addEventListener("quickjs-ready", handleReady);
//       window.addEventListener("quickjs-error", handleError);

//       document.head.appendChild(script);
//     });
//   }

//   static dispose(): void {
//     if (GlobalQuickJSManager.instance) {
//       // Properly dispose of the context if it exists
//       if (window.liteChatQuickJS?.context) {
//         try {
//           window.liteChatQuickJS.context.dispose();
//         } catch (e) {
//           console.error("Error disposing QuickJS context", e);
//         }
//       }
      
//       window.liteChatQuickJS = undefined;
//       GlobalQuickJSManager.instance.loadPromise = null;
//     }
//   }
// }

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
      reject(new Error('Timed out waiting for QuickJS to load. This may be due to network issues, CSP restrictions, or a script error.'));
    }, 10000); // 10 seconds
    window.addEventListener('quickjs-ready', onReady);
    window.addEventListener('quickjs-error', onError);
    window.dispatchEvent(new Event('get-quickjs'));
  });
};

const JsRunnableBlockRendererComponent: React.FC<
  JsRunnableBlockRendererProps
> = ({ code, isStreaming = false, interactionId, blockId, module }) => {
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

  // Security validation state
  const [securityResult, setSecurityResult] =
    useState<CodeSecurityResult | null>(null);
  const [isCheckingSecurity, setIsCheckingSecurity] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // LOCAL STATE: Safety mode toggle (per block) - Safe by default
  const [useSafeMode, setUseSafeMode] = useState(true);

  // LOCAL STATE: Track QuickJS loading state for UI updates
  const [quickjsStatus, setQuickjsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(() => {
    if (typeof window !== 'undefined' && window.liteChatQuickJS) {
      if (window.liteChatQuickJS.isReady) return 'ready';
      if (window.liteChatQuickJS.isLoading) return 'loading';
      return 'idle';
    }
    return 'idle';
  });

  // Keep quickjsStatus in sync with global state and events
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
    // Also update on mount
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

  // Reset security state when code changes
  useEffect(() => {
    setSecurityResult(null);
    setClickCount(0);
    setLastClickTime(0);
  }, [editedCode]);

  const codeRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
  }, [
    code,
    editedCode,
    isEditing,
    isFolded,
    showOutput,
    showPreview,
    highlightCode,
  ]);

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
      const result = await CodeSecurityService.validateCodeSecurity(
        codeToCheck,
        "javascript"
      );
      setSecurityResult(result);

      if (result.score > 90) {
        toast.error(
          `High-risk code detected (Score: ${result.score}/100). Please review carefully before running.`
        );
      } else if (result.score > 60) {
        toast.warning(
          `Potentially risky code detected (Score: ${result.score}/100). Use caution when running.`
        );
      } else if (result.score > 30) {
        toast.info(
          `Moderate-risk code detected (Score: ${result.score}/100). Review before running.`
        );
      } else {
        toast.success(
          `Code security check passed (Score: ${result.score}/100).`
        );
      }
    } catch (error) {
      console.error("Security check failed:", error);
      toast.error("Security check failed. Please try again.");
    } finally {
      setIsCheckingSecurity(false);
    }
  }, [code, editedCode, isEditing]);

  const executeCode = useCallback(async () => {
    let quickjsVm: any = undefined;
    // let QuickJS: any = undefined;
    
    if (useSafeMode) {
      if (window.liteChatQuickJS?.isReady && window.liteChatQuickJS.QuickJS && window.liteChatQuickJS.context) {
        // QuickJS = window.liteChatQuickJS.QuickJS;
        quickjsVm = window.liteChatQuickJS.context;
      } else {
        toast.error('Safe execution environment not ready. Please try running again.');
        setIsRunning(false);
        return;
      }
    }

    const capturedLogs: string[] = [];

    if (previewRef.current) {
      previewRef.current.innerHTML = "";
    }

    try {
      const codeToRun = isEditing ? editedCode : code;

      if (useSafeMode) {
        // QUICKJS MODE with improved DOM bridge and litechat API
        try {
          // Create litechat object with proper structure
          const litechatObj = quickjsVm.newObject();

          // Create utils object
          const utilsObj = quickjsVm.newObject();

          // Create log function for utils
          const utilsLogFn = quickjsVm.newFunction('log', (level: any, ...args: any[]) => {
            const jsLevel = quickjsVm.dump(level);
            const jsArgs = args.map((arg) => quickjsVm.dump(arg));
            capturedLogs.push(`[${jsLevel.toUpperCase()}] ${jsArgs.join(' ')}`);
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(utilsObj, 'log', utilsLogFn);

          // Create direct log function (for backward compatibility)
          const logFn = quickjsVm.newFunction('log', (...args: any[]) => {
            const jsArgs = args.map((arg) => quickjsVm.dump(arg));
            capturedLogs.push(jsArgs.join(' '));
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(litechatObj, 'log', logFn);

          // Set utils on litechat
          quickjsVm.setProp(litechatObj, 'utils', utilsObj);

          // Create toast function
          const toastFn = quickjsVm.newFunction('toast', (msg: any) => {
            const message = quickjsVm.dump(msg);
            toast(message);
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(litechatObj, 'toast', toastFn);

          // DOM Bridge - Map to track DOM nodes
          const nodeMap = new Map<string, Node>();
          let nodeIdCounter = 1;

          function genNodeId() {
            return `qjsnode_${nodeIdCounter++}`;
          }

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

          // Create text node
          const createTextNodeFn = quickjsVm.newFunction("__createTextNode", (text: any) => {
            const value = quickjsVm.dump(text);
            const node = document.createTextNode(value);
            const id = genNodeId();
            (node as any).__qjs_id = id;
            nodeMap.set(id, node);
            return quickjsVm.newString(id);
          });
          quickjsVm.setProp(quickjsVm.global, "__createTextNode", createTextNodeFn);

          // Set attribute
          const setAttributeFn = quickjsVm.newFunction("__setAttribute", (id: any, name: any, value: any) => {
            const el = nodeMap.get(quickjsVm.dump(id));
            if (el && el instanceof Element) {
              el.setAttribute(quickjsVm.dump(name), quickjsVm.dump(value));
            }
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(quickjsVm.global, "__setAttribute", setAttributeFn);

          // Remove attribute
          const removeAttributeFn = quickjsVm.newFunction("__removeAttribute", (id: any, name: any) => {
            const el = nodeMap.get(quickjsVm.dump(id));
            if (el && el instanceof Element) {
              el.removeAttribute(quickjsVm.dump(name));
            }
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(quickjsVm.global, "__removeAttribute", removeAttributeFn);

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

          // Remove child
          const removeChildFn = quickjsVm.newFunction("__removeChild", (parentId: any, childId: any) => {
            const parent = nodeMap.get(quickjsVm.dump(parentId));
            const child = nodeMap.get(quickjsVm.dump(childId));
            if (parent && child && parent.contains(child)) {
              parent.removeChild(child);
            }
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(quickjsVm.global, "__removeChild", removeChildFn);

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

          // Set style property
          const setStyleFn = quickjsVm.newFunction("__setStyle", (id: any, property: any, value: any) => {
            const node = nodeMap.get(quickjsVm.dump(id));
            if (node && node instanceof HTMLElement) {
              (node.style as any)[quickjsVm.dump(property)] = quickjsVm.dump(value);
            }
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(quickjsVm.global, "__setStyle", setStyleFn);

          // Add event listener
          const addEventListenerFn = quickjsVm.newFunction("__addEventListener", (id: any, event: any, handlerId: any) => {
            const node = nodeMap.get(quickjsVm.dump(id));
            const eventType = quickjsVm.dump(event);
            const hId = quickjsVm.dump(handlerId);
            if (node && node instanceof Element) {
              const handler = () => {
                try {
                  const callbackResult = quickjsVm.evalCode(`
                    if (typeof __eventHandlers !== 'undefined' && __eventHandlers['${hId}']) {
                      __eventHandlers['${hId}']();
                    }
                  `);
                  if (callbackResult.error) {
                    console.error('Event handler error:', quickjsVm.dump(callbackResult.error));
                    callbackResult.error.dispose();
                  } else {
                    callbackResult.value.dispose();
                  }
                } catch (e) {
                  console.error('Event handler execution error:', e);
                }
              };
              node.addEventListener(eventType, handler);
              (node as any)[`__handler_${hId}`] = handler;
            }
            return quickjsVm.undefined;
          });
          quickjsVm.setProp(quickjsVm.global, "__addEventListener", addEventListenerFn);

          // Set litechat as global
          quickjsVm.setProp(quickjsVm.global, 'litechat', litechatObj);
          quickjsVm.evalCode('globalThis.litechat = litechat;');

          // Virtual DOM API injection
          const vdomInjection = `
            // Event handlers registry
            var __eventHandlers = {};
            var __eventHandlerCounter = 0;

            function QNode(id) {
              this.__id = id;
            }
            
            QNode.prototype.setAttribute = function(name, value) {
              __setAttribute(this.__id, name, value);
              return this;
            };
            
            QNode.prototype.removeAttribute = function(name) {
              __removeAttribute(this.__id, name);
              return this;
            };
            
            QNode.prototype.appendChild = function(child) {
              __appendChild(this.__id, child.__id);
              return this;
            };
            
            QNode.prototype.removeChild = function(child) {
              __removeChild(this.__id, child.__id);
              return this;
            };

            QNode.prototype.addEventListener = function(event, handler) {
              var handlerId = '__handler_' + (++__eventHandlerCounter);
              __eventHandlers[handlerId] = handler;
              __addEventListener(this.__id, event, handlerId);
              return this;
            };

            QNode.prototype.setStyle = function(property, value) {
              __setStyle(this.__id, property, value);
              return this;
            };
            
            Object.defineProperty(QNode.prototype, 'textContent', {
              set: function(value) { 
                __setTextContent(this.__id, value); 
              },
              configurable: true
            });
            
            Object.defineProperty(QNode.prototype, 'innerHTML', {
              set: function(value) { 
                __setInnerHTML(this.__id, value); 
              },
              configurable: true
            });

            // Add style property to QNode
            Object.defineProperty(QNode.prototype, 'style', {
              get: function() {
                const self = this;
                // Proxy to handle cssText and individual property sets
                return new Proxy({}, {
                  set(target, prop, value) {
                    if (prop === 'cssText') {
                      // Parse cssText string and set each property
                      if (typeof value === 'string') {
                        value.split(';').forEach(function(rule) {
                          const [k, v] = rule.split(':');
                          if (k && v) {
                            __setStyle(self.__id, k.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase()), v.trim());
                          }
                        });
                      }
                      return true;
                    } else {
                      // Set individual property
                      __setStyle(self.__id, prop, value);
                      return true;
                    }
                  },
                  get(target, prop) {
                    if (prop === 'cssText') {
                      // Not tracked, just return empty string
                      return '';
                    }
                    // Not tracked, always undefined
                    return undefined;
                  }
                });
              },
              configurable: true
            });

            // Document API with proper createElement
            var document = {
              createElement: function(tag) {
                return new QNode(__createElement(tag));
              },
              createTextNode: function(text) {
                return new QNode(__createTextNode(text));
              },
              getRoot: function() {
                return new QNode(__getRootId());
              }
            };

            // Global document
            globalThis.document = document;
            
            // Enhanced litechat.target
            litechat.target = document.getRoot();
            
            // Add replaceChildren method to QNode
            QNode.prototype.replaceChildren = function() {
              __setInnerHTML(this.__id, '');
              return this;
            };
            
            // Helper functions
            litechat.createElement = function(tag) {
              return document.createElement(tag);
            };
            
            litechat.createTextNode = function(text) {
              return document.createTextNode(text);
            };
          `;

          // Execute the code with DOM bridge
          const sandboxCode = `
            (function() {
              ${vdomInjection}
              
              var logs = [];
              var console = {
                log: function() {
                  var args = Array.prototype.slice.call(arguments);
                  var message = args.map(function(arg) {
                    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                  }).join(' ');
                  logs.push(message);
                  if (typeof litechat !== 'undefined' && typeof litechat.log === 'function') {
                    litechat.log.apply(litechat, args);
                  }
                },
                error: function() {
                  var args = Array.prototype.slice.call(arguments);
                  var message = 'Error: ' + args.map(function(arg) {
                    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                  }).join(' ');
                  logs.push(message);
                  if (typeof litechat !== 'undefined' && typeof litechat.log === 'function') {
                    litechat.log('Error:', args.join(' '));
                  }
                },
                warn: function() {
                  var args = Array.prototype.slice.call(arguments);
                  var message = 'Warning: ' + args.map(function(arg) {
                    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                  }).join(' ');
                  logs.push(message);
                  if (typeof litechat !== 'undefined' && typeof litechat.log === 'function') {
                    litechat.log('Warning:', args.join(' '));
                  }
                }
              };
              
              var result;
              try {
                result = (function() {
                  ${codeToRun}
                })();
              } catch (error) {
                logs.push('Execution Error: ' + error.message);
                if (typeof litechat !== 'undefined' && typeof litechat.log === 'function') {
                  litechat.log('Execution Error:', error.message);
                }
              }
              
              return { result: result, logs: logs };
            })()
          `;

          const resultHandle = quickjsVm.evalCode(sandboxCode);
          
          if (resultHandle.error) {
            const errorMsg = quickjsVm.dump(resultHandle.error);
            capturedLogs.push(`QuickJS Error: ${errorMsg}`);
            resultHandle.error.dispose();
          } else {
            const result = quickjsVm.dump(resultHandle.value);
            
            if (result && result.logs && Array.isArray(result.logs)) {
              capturedLogs.push(...result.logs);
            }
            
            if (result && result.result !== undefined && result.result !== null) {
              capturedLogs.push(`Result: ${result.result}`);
            }
            
            resultHandle.value.dispose();
          }

          if (capturedLogs.length === 0) {
            capturedLogs.push("Code executed successfully in QuickJS sandbox (no output)");
          }

          // Clean up function handles
          logFn.dispose();
          utilsLogFn.dispose();
          toastFn.dispose();
          utilsObj.dispose();
          litechatObj.dispose();
          getRootIdFn.dispose();
          createElementFn.dispose();
          createTextNodeFn.dispose();
          setAttributeFn.dispose();
          removeAttributeFn.dispose();
          appendChildFn.dispose();
          removeChildFn.dispose();
          setTextContentFn.dispose();
          setInnerHTMLFn.dispose();
          setStyleFn.dispose();
          addEventListenerFn.dispose();
        } catch (error) {
          console.error("QuickJS execution error:", error);
          capturedLogs.push(
            `QuickJS execution failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else {
        // UNSAFE MODE: Direct execution
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        const captureAndLog = (
          level: "log" | "error" | "warn",
          ...args: any[]
        ) => {
          const formatted = args
            .map((arg) => {
              try {
                return typeof arg === "object"
                  ? JSON.stringify(arg)
                  : String(arg);
              } catch {
                return String(arg);
              }
            })
            .join(" ");

          if (level === "error") capturedLogs.push(`Error: ${formatted}`);
          else if (level === "warn") capturedLogs.push(`Warning: ${formatted}`);
          else capturedLogs.push(formatted);
        };

        console.log = (...args) => {
          captureAndLog("log", ...args);
          originalLog(...args);
        };
        console.error = (...args) => {
          captureAndLog("error", ...args);
          originalError(...args);
        };
        console.warn = (...args) => {
          captureAndLog("warn", ...args);
          originalWarn(...args);
        };

        try {
          let contextObj: any = {};
          if (module && module.getEnhancedContext) {
            contextObj = module.getEnhancedContext(
              capturedLogs,
              previewRef.current
            );
          } else {
            contextObj = {
              litechat: {
                utils: { log: console.log, toast },
                target: previewRef.current,
              },
            };
          }

          const asyncFunc = new Function(
            "litechat",
            `return (async () => { ${codeToRun} })();`
          );
          const result = asyncFunc(contextObj.litechat);

          if (result && typeof result.then === "function") {
            await result;
          }

          if (capturedLogs.length === 0) {
            capturedLogs.push("Code executed successfully (no output)");
          }
        } catch (error) {
          capturedLogs.push(
            `Execution Error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          console.log = originalLog;
          console.error = originalError;
          console.warn = originalWarn;
        }
      }
    } catch (error) {
      capturedLogs.push(
        `Execution Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setOutput(capturedLogs);
      setHasRun(true);
      setIsRunning(false);

      if (
        previewRef.current &&
        (previewRef.current.children.length > 0 ||
          previewRef.current.innerHTML.trim())
      ) {
        setShowPreview(true);
        setShowOutput(false);
      } else {
        setShowOutput(true);
        setShowPreview(false);
      }

      if (capturedLogs.some((log) => log.includes("Error:"))) {
        toast.error("Code execution failed - check output for details");
      } else {
        toast.success(
          `Code executed successfully ${
            useSafeMode ? "(safe mode)" : "(unsafe mode)"
          }`
        );
      }
    }
  }, [code, editedCode, isEditing, module, useSafeMode]);

  const handleRunClick = useCallback(async () => {
    if (!runnableBlocksEnabled) {
      toast.error('Runnable blocks are disabled in settings.');
      return;
    }
    // Multi-click security confirmation logic
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
        if (!window.confirm(`This code has a very high security risk score (${securityResult.score}/100). Are you absolutely sure you want to run it?`)) {
          setClickCount(0);
          return;
        }
      }
      // Reset click count and execute
      setClickCount(0);
    }
    setIsRunning(true);
    if (useSafeMode) {
      if (!window.liteChatQuickJS?.isReady || !window.liteChatQuickJS.QuickJS || !window.liteChatQuickJS.context) {
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

  // Determine run button style based on security result
  const getRunButtonStyle = () => {
    if (!securityResult) return {};

    return {
      backgroundColor: securityResult.color,
      borderColor: securityResult.color,
      color: securityResult.score > 50 ? "#ffffff" : "#000000",
    };
  };

  const getRunButtonText = () => {
    if (isRunning) return "Running...";
    if (quickjsStatus === 'loading') return "Loading...";
    if (useSafeMode && quickjsStatus !== 'ready') return "Run";
    if (
      securityResult &&
      clickCount > 0 &&
      clickCount < securityResult.clicksRequired
    ) {
      return `Click ${securityResult.clicksRequired - clickCount} more`;
    }
    return "Run";
  };

  // Check if preview has content (either DOM children or innerHTML content)
  const hasPreviewContent =
    hasRun &&
    previewRef.current &&
    (previewRef.current.children.length > 0 ||
      previewRef.current.innerHTML.trim().length > 0);

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">RUNNABLE JS</div>
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
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              useSafeMode
                ? "bg-green-100 text-green-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {useSafeMode ? "SAFE" : "UNSAFE"}
          </span>
          {securityResult && (
            <div
              className="flex items-center gap-1 text-xs"
              style={{ color: securityResult.color }}
            >
              <ShieldIcon className="h-3 w-3" />
              <span>
                {securityResult.score}/100 ({securityResult.riskLevel})
              </span>
            </div>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="safe-mode-toggle" className="text-xs">
              {useSafeMode ? "Safe" : "Unsafe"}
            </Label>
            <Switch
              id="safe-mode-toggle"
              checked={useSafeMode}
              onCheckedChange={setUseSafeMode}
              className="scale-75"
            />
          </div>
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
            {securityResult ? "Recheck" : "Check"}
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
            disabled={isRunning || quickjsStatus === 'loading' || !runnableBlocksEnabled}
            className="text-xs h-7"
            style={getRunButtonStyle()}
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

      {!isFolded && !showOutput && !showPreview && isEditing && (
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
            CONSOLE OUTPUT:
          </div>
          {output.length > 0 ? (
            output.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("Execution Error:")
                    ? "text-red-400"
                    : line.startsWith("Error:")
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

      {/* ALWAYS render preview element (hidden when not shown) so ref is always available */}
      <div
        ref={previewRef}
        className={
          !isFolded && showPreview
            ? "preview-container border border-border rounded-b-lg bg-background p-4"
            : "hidden"
        }
      >
        {!isFolded && showPreview && (
          <>
            <div className="preview-header text-muted-foreground mb-2 text-xs font-semibold">
              PREVIEW:
            </div>
            <div className="preview-content min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-2">
              {!hasPreviewContent && (
                <div className="text-muted-foreground text-sm italic">
                  No preview content. Use{" "}
                  <code>litechat.target.appendChild(element)</code> to add DOM
                  elements here.
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

export const JsRunnableBlockRenderer = memo(JsRunnableBlockRendererComponent);