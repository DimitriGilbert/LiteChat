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
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { AlertCircleIcon, Loader2Icon, DownloadIcon, CodeIcon, ImageIcon } from "lucide-react";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FlowData, FlowNode, StepStatus } from "@/types/litechat/flow";
import { JSONFlowParser, autoLayoutNodes } from "@/lib/litechat/flow-parser";

import '@xyflow/react/dist/style.css';

interface FlowBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

// Custom Flow Node Component
const FlowStepNode: React.FC<{ data: any }> = ({ data }) => {
  const getNodeColor = (type: string, status?: StepStatus) => {
    // Status-based colors take priority (with glow)
    if (status) {
      switch (status) {
        case 'running':
          return 'bg-blue-50 border-blue-400 text-blue-900 shadow-lg shadow-blue-200';
        case 'success':
          return 'bg-green-50 border-green-400 text-green-900 shadow-lg shadow-green-200';
        case 'error':
          return 'bg-red-50 border-red-400 text-red-900 shadow-lg shadow-red-200';
        case 'pending':
          return 'bg-gray-50 border-gray-300 text-gray-700 shadow-lg shadow-gray-200';
      }
    }

    // Default type-based colors (minimal shadow when no status)
    switch (type) {
      case 'trigger':
        return 'bg-indigo-100 border-indigo-400 text-indigo-900 shadow-sm';
      case 'prompt':
        return 'bg-green-100 border-green-400 text-green-900 shadow-sm';
      case 'agent-task':
        return 'bg-purple-100 border-purple-400 text-purple-900 shadow-sm';
      case 'human-in-the-loop':
        return 'bg-orange-100 border-orange-400 text-orange-900 shadow-sm';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-900 shadow-sm';
    }
  };

  const getTypeIcon = (type: string, status?: StepStatus) => {
    // Status-based icons take priority
    if (status) {
      switch (status) {
        case 'running':
          return '⏳';
        case 'success':
          return '✅';
        case 'error':
          return '❌';
        case 'pending':
          return '⏸️';
      }
    }

    // Default type-based icons
    switch (type) {
      case 'trigger':
        return '🎯';
      case 'prompt':
        return '💬';
      case 'agent-task':
        return '🤖';
      case 'human-in-the-loop':
        return '👤';
      default:
        return '⚙️';
    }
  };

  return (
    <div className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px] max-w-[280px]',
      getNodeColor(data.type, data.status)
    )}>
      <Handle type="target" position={Position.Left} id="input" className="!bg-gray-700" />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{getTypeIcon(data.type, data.status)}</span>
        <span className="font-semibold text-sm">{data.label || data.name}</span>
        {data.status && (
          <span className="text-xs px-2 py-1 rounded-full bg-white/60 font-medium capitalize">
            {data.status}
          </span>
        )}
      </div>
      
      {data.templateName && (
        <div className="text-sm font-medium mb-1 text-slate-700">
          {data.templateName}
        </div>
      )}
      
      {data.modelName && (
        <div className="text-xs opacity-75 font-mono bg-white/50 px-2 py-1 rounded">
          {data.modelName}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} id="output" className="!bg-gray-700" />
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
  const [, setFlowData] = useState<FlowData | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parserRef = useRef(new JSONFlowParser());

  // Debug logging for streaming flow detection
  // useEffect(() => {
  //   console.log(`[FlowBlockRenderer] Props updated:`, {
  //     codeLength: code?.length || 0,
  //     isStreaming,
  //     isFolded,
  //     codePreview: code?.substring(0, 100) + (code?.length > 100 ? '...' : ''),
  //   });
  // }, [code, isStreaming, isFolded]);

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

  const parseFlow = useCallback(async () => {
    if (!code.trim() || isFolded) {
      return;
    }

    // For streaming content, check if JSON is complete before parsing
    if (isStreaming) {
      const trimmedCode = code.trim();
      
      // Quick check: does it start with { and end with }?
      if (!trimmedCode.startsWith('{') || !trimmedCode.endsWith('}')) {
        // Not complete JSON yet, don't show error
        setError(null);
        setNodes([]);
        setEdges([]);
        return;
      }
      
      // Try to validate it's complete JSON without full parsing
      try {
        JSON.parse(trimmedCode);
        // If we get here, JSON is complete and valid
      } catch (jsonError) {
        // JSON is not complete/valid yet during streaming
        setError(null);
        setNodes([]);
        setEdges([]);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setFlowData(null);
    setNodes([]);
    setEdges([]);

    try {
      const parseResult = await parserRef.current.parse(code.trim());
      
      if (!parseResult.success) {
        // Only show errors when not streaming or JSON appears complete
        if (!isStreaming) {
          setError(parseResult.error || "Failed to parse flow data");
        }
        return;
      }

      if (!parseResult.data) {
        if (!isStreaming) {
          setError("No flow data returned from parser");
        }
        return;
      }

      const data = parseResult.data;
      setFlowData(data);

      // Apply auto-layout if needed
      const layoutedNodes = autoLayoutNodes(data.nodes);

      // Convert to React Flow format
      const reactFlowNodes: Node[] = layoutedNodes.map((node: FlowNode) => ({
        id: node.id,
        type: 'flowStep',
        position: node.position,
        data: {
          type: node.type,
          label: node.label,
          status: node.status,
          templateName: node.data?.templateName,
          modelName: node.data?.modelName,
          ...node.data,
        },
      }));

      const reactFlowEdges: Edge[] = data.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
        animated: edge.animated || false,
        style: edge.style || { 
          stroke: '#1f2937',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#1f2937',
          width: 18,
          height: 18,
        },
      }));

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    } catch (err) {
      console.error("[FlowBlockRenderer.parseFlow] Flow parsing error:", err);
      setError(err instanceof Error ? err.message : "Failed to parse flow data");
    } finally {
      setIsLoading(false);
    }
  }, [code, isFolded]);

  useEffect(() => {
    if (!isFolded && code.trim() && !showCode) {
      // For streaming: shorter debounce to check for complete JSON more frequently
      // For completed: immediate parsing
      const delay = isStreaming ? 100 : 0; // Shorter delay for better responsiveness
      const timeoutId = setTimeout(parseFlow, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [code, isFolded, showCode, parseFlow, isStreaming]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding && !showCode) {
      setTimeout(parseFlow, 0);
    }
  };

  const handleDownloadSvg = useCallback(async () => {
    if (!containerRef.current) {
      toast.error("No flow content to download");
      return;
    }

    try {
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) {
        toast.error("No SVG element found");
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "flow-diagram.svg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("SVG downloaded successfully!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download SVG");
    }
  }, []);

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
    <div className="code-block-container group/codeblock my-4 max-w-full">
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
          
          {/* Download SVG button - only show when diagram is rendered */}
          {nodes.length > 0 && !showCode && !error && (
            <button
              onClick={handleDownloadSvg}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
              title="Download SVG"
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
                  <div 
                    ref={containerRef}
                    className="flow-container h-96 bg-background border rounded-md"
                  >
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      fitView
                      fitViewOptions={{
                        padding: 50,
                        maxZoom: 2.25,
                        minZoom: 0.15,
                      }}
                      proOptions={{ hideAttribution: true }}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={true}
                      zoomOnScroll={true}
                      panOnScroll={false}
                      zoomOnDoubleClick={true}
                      panOnDrag={true}
                      className="bg-background"
                    >
                      <MiniMap 
                        nodeColor={(node) => {
                          if (node.data?.status) {
                            switch (node.data.status) {
                              case 'running': return '#3b82f6';
                              case 'success': return '#10b981';
                              case 'error': return '#ef4444';
                              case 'pending': return '#6b7280';
                            }
                          }
                          switch (node.data?.type) {
                            case 'trigger': return '#6366f1';
                            case 'prompt': return '#10b981';
                            case 'agent-task': return '#8b5cf6';
                            case 'human-in-the-loop': return '#f59e0b';
                            default: return '#6b7280';
                          }
                        }}
                        position="bottom-right"
                        style={{ width: 120, height: 80 }}
                      />
                      <Controls position="top-left" showInteractive={false} />
                      <Background variant={BackgroundVariant.Dots} gap={20} size={2} />
                    </ReactFlow>
                  </div>
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

export const FlowBlockRenderer = memo(FlowBlockRendererComponent); 