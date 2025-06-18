export type StepStatus = 'pending' | 'running' | 'success' | 'error';

export interface FlowNode {
  id: string;
  type: 'trigger' | 'prompt' | 'agent-task' | 'human-in-the-loop' | 'custom';
  label: string;
  position: { x: number; y: number };
  status?: StepStatus;
  data?: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  type?: string;
  style?: Record<string, any>;
  markerEnd?: Record<string, any>;
}

export interface FlowData {
  type: 'workflow' | 'custom';
  name?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
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