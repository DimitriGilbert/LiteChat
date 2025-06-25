import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  MarkerType as XYMarkerType,
  Handle,
  Position,
  ReactFlowProvider,
} from '@xyflow/react';
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/shallow";
import type { StepStatus } from "@/types/litechat/flow";
import { JSONFlowParser } from "@/lib/litechat/flow-parser";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControl, CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { AlertCircleIcon, Loader2Icon, DownloadIcon, CodeIcon, ImageIcon } from "lucide-react";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTreeLayout } from '@/lib/litechat/tree-layout';
import { toPng } from 'html-to-image';

import '@xyflow/react/dist/style.css';

interface FlowBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

// Flow step node component
const FlowStepNode: React.FC<{ data: any }> = ({ data }) => {
  // Type-safe access to node data
  const label = data.label || data.stepName || data.id || 'Unknown Step';
  const type = data.type || 'default';
  const status = data.status as StepStatus;

  const getNodeColor = (type: string, status?: StepStatus) => {
    if (status) {
      switch (status) {
        case 'running':
          return 'bg-[var(--card-foreground)] border-[var(--primary)] text-[var(--secondary)] shadow-lg shadow-[var(--primary)/20]';
        case 'success':
          return 'bg-[var(--card-foreground)] border-[var(--chart-2)] text-[var(--primary)] shadow-lg shadow-[var(--chart-2)/20]';
        case 'error':
          return 'bg-[var(--card-foreground)] border-[var(--destructive)] text-[var(--destructive)] shadow-lg shadow-[var(--destructive)/20]';
        case 'pending':
          return 'bg-[var(--card-foreground)] border-[var(--muted)] text-[var(--background)] shadow-lg shadow-[var(--muted)/20]';
      }
    }
    switch (type) {
      case 'trigger':
      case 'input':
        return 'bg-[var(--card-foreground)] border-[var(--primary)] text-[var(--card)] shadow-sm';
      case 'prompt':
        return 'bg-[var(--card-foreground)] border-[var(--chart-1)] text-[var(--card)] shadow-sm';
      case 'agent-task':
        return 'bg-[var(--card-foreground)] border-[var(--chart-2)] text-[var(--card)] shadow-sm';
      case 'transform':
        return 'bg-[var(--card-foreground)] border-[var(--chart-3)] text-[var(--card)] shadow-sm';
      case 'human-in-the-loop':
        return 'bg-[var(--card-foreground)] border-[var(--chart-4)] text-[var(--card)] shadow-sm';
      case 'output':
        return 'bg-[var(--card-foreground)] border-[var(--chart-5)] text-[var(--card)] shadow-sm';
      default:
        return 'bg-[var(--card-foreground)] border-[var(--border)] text-[var(--card)] shadow-sm';
    }
  };

  const getTypeIcon = (type: string, status?: StepStatus) => {
    if (status === 'running') return '⚡';
    if (status === 'error') return '❌';
    if (status === 'success') return '✅';
    
    switch (type) {
      case 'trigger':
      case 'input':
        return '🚀';
      case 'prompt':
        return '💬';
      case 'agent-task':
        return '🤖';
      case 'transform':
        return '🔄';
      case 'human-in-the-loop':
        return '👤';
      case 'output':
        return '🎯';
      default:
        return '📋';
    }
  };

  const colorClasses = getNodeColor(type, status);
  const icon = getTypeIcon(type, status);

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 min-w-[180px] max-w-[220px]',
        colorClasses
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
      
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-tight break-words">
            {label}
          </div>
          {data.templateName && (
            <div className="text-xs opacity-75 break-words">
              {data.templateName}
            </div>
          )}
          {data.modelName && (
            <div className="text-xs opacity-60 break-words">
              {data.modelName}
            </div>
          )}
        </div>
      </div>
      
      {data.description && (
        <div className="text-xs opacity-70 mt-1 break-words">
          {data.description}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  );
};

// Node types configuration
const nodeTypes = {
  flowStep: FlowStepNode,
};

const FlowBlockRendererComponent: React.FC<FlowBlockRendererProps> = ({
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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [isReactFlowReady, setIsReactFlowReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parserRef = useRef(new JSONFlowParser());

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
              codeBlockLang: "flow",
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

  // Unified flow parsing logic
  const parseFlowData = useCallback(async () => {
    if (!code.trim() || isFolded) {
      setNodes([]);
      setEdges([]);
      setError(null);
      setIsReactFlowReady(false);
      return;
    }

    // For streaming content, check if JSON is complete before parsing
    if (isStreaming) {
      const trimmedCode = code.trim();
      
      // Quick check: does it start with { and end with }?
      if (!trimmedCode.startsWith('{') || !trimmedCode.endsWith('}')) {
        // Not complete JSON yet, don't show error
        setError(null);
        return;
      }
      
      // Try to validate it's complete JSON without full parsing
      try {
        JSON.parse(trimmedCode);
        // If we get here, JSON is complete and valid
      } catch (jsonError) {
        // JSON is not complete/valid yet during streaming
        setError(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setIsReactFlowReady(false); // Reset ready state when parsing new data

    try {
      const parseResult = await parserRef.current.parse(code.trim());
      
      if (!parseResult.success) {
        // Only show errors when not streaming or JSON appears complete
        if (!isStreaming) {
          setError(parseResult.error || "Unknown parse error");
        }
        setNodes([]);
        setEdges([]);
        setIsLoading(false);
        return;
      }

      const data = parseResult.data;
      if (!data) {
        if (!isStreaming) {
          setError("No data returned from parser");
        }
        setNodes([]);
        setEdges([]);
        setIsLoading(false);
        return;
      }

      // Convert flow nodes to ReactFlow nodes
      let reactFlowNodes = data.nodes.map(node => ({
        id: node.id,
        position: node.position || { x: 0, y: 0 },
        type: 'flowStep',
        data: node as unknown as Record<string, unknown>
      })) as Node[];
      
      // Convert flow edges to ReactFlow edges - preserve all original properties
      let reactFlowEdges = data.edges.map(edge => ({
        ...edge, // Preserve all original edge properties
        markerEnd: edge.markerEnd || { type: XYMarkerType.ArrowClosed }
      })) as Edge[];

      // Only apply auto-layout if nodes don't have positions
      const needsLayout = reactFlowNodes.every(node => 
        !node.position || (node.position.x === 0 && node.position.y === 0)
      );
      
      if (needsLayout) {
        // Use the tree layout that respects the actual edge connections
        reactFlowNodes = getTreeLayout(reactFlowNodes, reactFlowEdges, [220, 120]);
      }

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);

    } catch (err) {
      console.error("[FlowBlockRenderer.parseFlowData] Flow parsing error:", err);
      if (!isStreaming) {
        setError(err instanceof Error ? err.message : "Failed to parse flow data");
      }
      setNodes([]);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  }, [code, isFolded, isStreaming]);

  useEffect(() => {
    if (!isFolded && code.trim() && !showCode) {
      // For streaming: shorter debounce to check for complete JSON more frequently
      // For completed: immediate parsing
      const delay = isStreaming ? 100 : 0;
      const timeoutId = setTimeout(parseFlowData, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [code, isFolded, showCode, parseFlowData, isStreaming]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding && !showCode) {
      setTimeout(parseFlowData, 0);
    }
  };

  const handleDownloadSvg = useCallback(async () => {
    if (!containerRef.current) {
      toast.error("No flow content to download");
      return;
    }

    // Additional check for ReactFlow readiness
    if (!isReactFlowReady) {
      toast.error("Flow is still loading, please wait...");
      return;
    }

    try {
      // Wait for the flow viewport to be ready with better retry logic
      const waitForFlowViewport = async (maxAttempts = 15, delay = 200): Promise<Element | null> => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const flowViewport = containerRef.current?.querySelector('.react-flow__viewport');
          if (flowViewport) {
            // Check if viewport has actual content
            const hasNodes = flowViewport.querySelector('[data-id]');
            if (hasNodes) {
              return flowViewport;
            }
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return null;
      };

      const flowViewport = await waitForFlowViewport();
      if (!flowViewport) {
        toast.error("Flow viewport not ready. Please try again in a moment.");
        return;
      }

      // Get background from the flow container to respect themes
      const flowContainer = containerRef.current.querySelector('.flow-container') as HTMLElement;
      const backgroundColor = flowContainer 
        ? window.getComputedStyle(flowContainer).backgroundColor 
        : 'white';

      // Use the simple approach that works reliably
      const dataUrl = await toPng(flowViewport as HTMLElement, {
        backgroundColor: backgroundColor,
        filter: (node: Element) => {
          return !(
            node?.classList?.contains('react-flow__minimap') ||
            node?.classList?.contains('react-flow__controls')
          );
        },
      });

      const link = document.createElement('a');
      link.download = 'flow-diagram.png';
      link.href = dataUrl;
      link.click();
      
      toast.success("Flow diagram downloaded successfully!");
      
    } catch (error) {
      console.error("Error downloading flow diagram:", error);
      toast.error("Failed to download flow diagram");
    }
  }, [isReactFlowReady]);

  const toggleView = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

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
    "flow",
    isFolded,
    toggleFold
  );

  return (
    <div 
      ref={containerRef}
      className="code-block-container group/codeblock my-4 max-w-full"
    >
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">FLOW</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          {/* Toggle between diagram and code view */}
          <button
            onClick={toggleView}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={showCode ? "Show diagram" : "Show code"}
          >
            {showCode ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <CodeIcon className="h-4 w-4" />
            )}
          </button>
          
          {/* Download PNG button - only show when ReactFlow is ready and diagram is rendered */}
          {isReactFlowReady && !showCode && !error && (
            <button
              onClick={handleDownloadSvg}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              title="Download as PNG"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

        {!isFolded && (
          <div className="overflow-hidden w-full">
            {showCode ? (
              // Show raw code using CodeBlockRenderer
              <CodeBlockRenderer
                lang="json"
                code={code}
                isStreaming={isStreaming}
              />
            ) : (
              // Show flow diagram
              <>
                {isLoading && (
                  <div className="flex items-center justify-center p-8">
                    <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Parsing flow...
                    </span>
                  </div>
                )}
                
                {error && (
                  <div className="flex items-center gap-2 p-4 border border-destructive/20 bg-destructive/10 rounded-md">
                    <AlertCircleIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div className="text-sm text-destructive">
                      <div className="font-medium">Failed to parse flow data</div>
                      <div className="text-xs mt-1 opacity-80">{error}</div>
                    </div>
                  </div>
                )}
                
                {nodes.length > 0 && !isLoading && !error && (
                  <ReactFlowProvider>
                    <FlowContent 
                      nodes={nodes} 
                      edges={edges} 
                      onReady={() => setIsReactFlowReady(true)}
                    />
                  </ReactFlowProvider>
                )}
                
                {!nodes.length && !isLoading && !error && (
                  <div className="flex items-center justify-center h-48 border-2 border-dashed border-border rounded-lg">
                    <div className="text-center text-muted-foreground">
                      {isStreaming ? (
                        <>
                          <div className="text-4xl mb-2">⏳</div>
                          <div className="text-lg font-medium">Streaming flow data...</div>
                          <div className="text-sm">Waiting for complete JSON</div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-2">📊</div>
                          <div className="text-lg font-medium">No flow data</div>
                          <div className="text-sm">Check the flow format</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
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

// Flow content component that uses ReactFlow hooks
const FlowContent: React.FC<{
  nodes: Node[];
  edges: Edge[];
  onReady: () => void;
}> = ({ nodes, edges, onReady }) => {

  useEffect(() => {
    // Set ready when ReactFlow has mounted and has nodes
    if (nodes.length > 0) {
      // Add a small delay to ensure ReactFlow has fully rendered
      const timeout = setTimeout(() => {
        onReady();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [nodes.length, onReady]);

  return (
    <div className="flow-container h-96 bg-background border rounded-md">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export const FlowBlockRenderer = memo(FlowBlockRendererComponent); 