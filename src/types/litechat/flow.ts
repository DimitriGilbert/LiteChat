export type StepStatus = 'pending' | 'running' | 'success' | 'error';

export type NodeType = 'trigger' | 'prompt' | 'agent-task' | 'human-in-the-loop' | 'transform' | 'custom' | 'input' | 'output' | 'default' | 'group' | 'tool-call' | 'custom-prompt' | 'function' | 'parallel' | 'sub-workflow';
export type EdgeType = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier' | 'custom';
export type MarkerType = 'Arrow' | 'ArrowClosed';

export interface NodeStyle {
  background?: string;
  backgroundColor?: string;
  color?: string;
  border?: string;
  borderColor?: string;
  borderWidth?: number | string;
  borderRadius?: number | string;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  padding?: number | string;
  margin?: number | string;
  fontSize?: number | string;
  fontWeight?: number | string;
  opacity?: number;
  boxShadow?: string;
}

export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeOpacity?: number;
  fill?: string;
  color?: string;
  opacity?: number;
}

export interface EdgeMarker {
  type?: MarkerType;
  width?: number;
  height?: number;
  color?: string;
  orient?: string;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  position?: { x: number; y: number };
  status?: StepStatus;
  data?: Record<string, any>;
  style?: NodeStyle;
  className?: string;
  width?: number;
  height?: number;
  hidden?: boolean;
  selected?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
  type?: EdgeType;
  style?: EdgeStyle;
  markerStart?: EdgeMarker | string;
  markerEnd?: EdgeMarker | string;
  label?: string;
  labelStyle?: Record<string, any>;
  labelShowBg?: boolean;
  labelBgStyle?: Record<string, any>;
  hidden?: boolean;
  selected?: boolean;
  deletable?: boolean;
  updatable?: boolean;
}

export interface FlowBackground {
  variant?: 'dots' | 'lines' | 'cross';
  gap?: number | [number, number];
  size?: number;
  offset?: number | [number, number];
  lineWidth?: number;
  color?: string;
  bgColor?: string;
}

export interface FlowViewport {
  x?: number;
  y?: number;
  zoom?: number;
}

export interface FlowData {
  type: 'workflow' | 'process' | 'diagram' | 'mindmap' | 'architecture' | 'flowchart' | 'custom';
  name?: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  background?: FlowBackground;
  viewport?: FlowViewport;
  metadata?: Record<string, any>;
}

export interface ParseResult {
  success: boolean;
  data?: FlowData;
  error?: string;
}

export interface FlowParser {
  parse(code: string): Promise<ParseResult>;
  validate(code: string): Promise<ParseResult>;
  serialize(flowData: FlowData): string;
}

export interface FlowContentGenerator {
  generateInitialFlow(run: any): string;
  updateNodeStatus(content: string, nodeId: string, status: StepStatus): string;
  addStepOutput(content: string, nodeId: string, output: any): string;
  finalizeWorkflow(content: string, finalOutput: Record<string, any>): string;
} 