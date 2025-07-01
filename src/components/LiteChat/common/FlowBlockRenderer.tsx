import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
  ComponentType,
} from "react";
import { useTranslation } from "react-i18next";
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
  type NodeProps,
} from '@xyflow/react';
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/shallow";
import { JSONFlowParser } from "@/lib/litechat/flow-parser";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControl, CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { AlertCircleIcon, Loader2Icon, DownloadIcon, CodeIcon, ImageIcon } from "lucide-react";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTreeLayout } from '@/lib/litechat/tree-layout';
import { toPng } from 'html-to-image';
import DOMPurify from 'dompurify';

import '@xyflow/react/dist/style.css';

interface FlowBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

// Flow step node component
const FlowStepNode: React.FC<NodeProps<any>> = ({ data }) => {
  const { t } = useTranslation('renderers');
  const label = data.label || data.stepName || data.id || t('flowBlock.unknownStep');
  const type = data.type || 'default';
  const nodeStyle = data.style || {};
  const nodeClassName = data.className || '';
  const showIcon = !(type === 'custom' || (typeof type === 'string' && type.startsWith('custom-')));
  const edges = data.edges || []; // Get edges from node data

  // Get handle positions from node data
  const sourcePosition = data.sourcePosition;
  const targetPosition = data.targetPosition;

  // Only allow <img> and <svg> tags in label HTML
  const sanitizeLabel = (raw: string) => {
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['img', 'svg', 'path', 'circle', 'rect', 'g', 'line', 'ellipse', 'polygon', 'polyline', 'text', 'tspan', 'defs', 'linearGradient', 'stop', 'title', 'desc'],
      ALLOWED_ATTR: ['src', 'alt', 'width', 'height', 'style', 'viewBox', 'fill', 'stroke', 'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'class', 'id', 'opacity', 'stop-color', 'stop-opacity', 'offset', 'xmlns'],
      KEEP_CONTENT: false
    });
  };

  // Helper to convert position strings to Position enum
  const getPositionFromString = (pos: string): Position => {
    switch (pos?.toLowerCase()) {
      case 'top': return Position.Top;
      case 'bottom': return Position.Bottom;
      case 'left': return Position.Left;
      case 'right': return Position.Right;
      default: return Position.Bottom; // Default fallback
    }
  };

  // Collect all handles needed for this node from edges
  const handleDefs: { type: 'source' | 'target'; id: string; position: Position }[] = [];
  const handleSet = new Set<string>();

  // Find all edges where this node is involved
  edges.forEach((edge: Edge) => {
    if (edge.source === data.id) {
      // Create unique handle ID based on edge handle or position
      const edgeHandle = edge.sourceHandle;
      const handleId = edgeHandle || 'output';
      const key = `source:${handleId}`;
      if (!handleSet.has(key)) {
        // For source handles: use edge.sourceHandle to determine position, fallback to node.sourcePosition, then default
        let position = Position.Bottom;
        if (edgeHandle) {
          position = getPositionFromString(edgeHandle);
        } else if (sourcePosition) {
          position = getPositionFromString(sourcePosition);
        }
        handleDefs.push({ type: 'source', id: handleId, position });
        handleSet.add(key);
      }
    }
    if (edge.target === data.id) {
      // Create unique handle ID based on edge handle or position
      const edgeHandle = edge.targetHandle;
      const handleId = edgeHandle || 'input';
      const key = `target:${handleId}`;
      if (!handleSet.has(key)) {
        // For target handles: use edge.targetHandle to determine position, fallback to node.targetPosition, then default
        let position = Position.Top;
        if (edgeHandle) {
          position = getPositionFromString(edgeHandle);
        } else if (targetPosition) {
          position = getPositionFromString(targetPosition);
        }
        handleDefs.push({ type: 'target', id: handleId, position });
        handleSet.add(key);
      }
    }
  });

  // Always ensure we have default handles if none are defined by edges
  if (!handleSet.has('source:output')) {
    const position = sourcePosition ? getPositionFromString(sourcePosition) : Position.Bottom;
    handleDefs.push({ type: 'source', id: 'output', position });
  }
  if (!handleSet.has('target:input')) {
    const position = targetPosition ? getPositionFromString(targetPosition) : Position.Top;
    handleDefs.push({ type: 'target', id: 'input', position });
  }

  const mergedStyle = { ...nodeStyle };

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 min-w-[180px] max-w-[220px]',
        nodeClassName
      )}
      style={mergedStyle}
    >
      {/* Render handles with correct positions */}
      {handleDefs.map(h => (
        <Handle
          key={h.type + ':' + h.id}
          type={h.type}
          position={h.position}
          id={h.id}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      ))}
      
      <div className="flex items-center gap-2 mb-1">
        {showIcon && <span className="text-lg">{data.icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-tight break-words">
            {typeof label === 'string' && /<(img|svg)[\s>]/i.test(label) ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizeLabel(label) }} />
            ) : (
              label
            )}
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
    </div>
  );
};

// Node types configuration
const nodeTypes: { [key: string]: ComponentType<any> } = {
  flowStep: FlowStepNode as ComponentType<any>,
};

const FlowBlockRendererComponent: React.FC<FlowBlockRendererProps> = ({
  code,
  isStreaming = false,
}) => {
  const { t } = useTranslation('renderers');
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
          setError(parseResult.error || t('flowBlock.parseError'));
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

      // Check for explicit positions on original data nodes BEFORE converting
      const hasExplicitPositions = data.nodes.some(node => 
        node.position && (node.position.x !== 0 || node.position.y !== 0)
      );

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
      
      if (!hasExplicitPositions) {
        // Use the tree layout for nodes without explicit positions
        reactFlowNodes = getTreeLayout(reactFlowNodes, reactFlowEdges, [220, 120]);
      } else {
        // Check if we have a mix of positioned and unpositioned nodes
        const unpositionedNodes = reactFlowNodes.filter(node => 
          !node.position || (node.position.x === 0 && node.position.y === 0)
        );
        
        if (unpositionedNodes.length > 0) {
          // Apply a simple grid layout to unpositioned nodes
          const gridSpacing = 250;
          const cols = Math.ceil(Math.sqrt(unpositionedNodes.length));
          
          unpositionedNodes.forEach((node, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            // Position unpositioned nodes in a grid starting from (0, 0)
            node.position = {
              x: col * gridSpacing,
              y: row * gridSpacing
            };
          });
        }
      }

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);

    } catch (err) {
      console.error("[FlowBlockRenderer.parseFlowData] Flow parsing error:", err);
      if (!isStreaming) {
        setError(err instanceof Error ? err.message : t('flowBlock.unknownParseError'));
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
      toast.error(t('flowBlock.containerNotFound'));
      return;
    }

    // Additional check for ReactFlow readiness
    if (!isReactFlowReady) {
      toast.error(t('flowBlock.flowStillLoading'));
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
        toast.error(t('flowBlock.flowViewportNotReady'));
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
      
      toast.success(t('flowBlock.downloadSuccess'));
      
    } catch (error) {
      console.error("Error downloading flow diagram:", error);
      toast.error(t('flowBlock.downloadFailed'));
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

  // Add useCallback for stable onReady reference
  const handleFlowReady = useCallback(() => {
    setIsReactFlowReady(true);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="code-block-container group/codeblock my-4 max-w-full"
    >
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">{t('flowBlock.header')}</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          {/* Toggle between diagram and code view */}
          <button
            onClick={toggleView}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={showCode ? t('flowBlock.showFlowTitle') : t('flowBlock.showCodeTitle')}
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
              title={t('flowBlock.downloadFlowTitle')}
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
                      {t('flowBlock.parsingData')}
                    </span>
                  </div>
                )}
                
                {error && (
                  <div className="flex items-center gap-2 p-4 border border-destructive/20 bg-destructive/10 rounded-md">
                    <AlertCircleIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div className="text-sm text-destructive">
                      <div className="font-medium">{t('flowBlock.dataErrorTitle')}</div>
                      <div className="text-xs mt-1 opacity-80">{error}</div>
                    </div>
                  </div>
                )}
                
                {nodes.length > 0 && !isLoading && !error && (
                  <ReactFlowProvider>
                    <FlowContent 
                      nodes={nodes} 
                      edges={edges} 
                      onReady={handleFlowReady}
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
    if (nodes.length > 0) {
      const timeout = setTimeout(() => {
        onReady();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [nodes.length, onReady]);

  // Inject edges into each node's data so FlowStepNode can access them
  const nodesWithEdges = useMemo(() => 
    nodes.map(node => ({
      ...node,
      data: { ...node.data, edges }
    })), [nodes, edges]
  );

  return (
    <div className="flow-container h-96 bg-background border rounded-md">
      <ReactFlow
        nodes={nodesWithEdges}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.1,
          maxZoom: 1.5
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export const FlowBlockRenderer = memo(FlowBlockRendererComponent); 