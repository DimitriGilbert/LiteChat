import type { FlowParser, FlowData, ParseResult, FlowNode, FlowEdge, StepStatus } from "@/types/litechat/flow";

export class JSONFlowParser implements FlowParser {
  async parse(code: string): Promise<ParseResult> {
    try {
      const trimmedCode = code.trim();
      if (!trimmedCode) {
        return { success: false, error: "Empty flow content" };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(trimmedCode);
      } catch (jsonError) {
        return { 
          success: false, 
          error: `Invalid JSON format: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}` 
        };
      }

      // Validate the parsed data
      const validationResult = await this.validate(trimmedCode);
      if (!validationResult.success) {
        return validationResult;
      }

      return { success: true, data: parsed as FlowData };
    } catch (error) {
      return { 
        success: false, 
        error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async validate(code: string): Promise<ParseResult> {
    try {
      const parsed = JSON.parse(code.trim());

      // Check required fields
      if (!parsed.type) {
        return { success: false, error: "Missing required field: type" };
      }

      if (!Array.isArray(parsed.nodes)) {
        return { success: false, error: "Missing or invalid field: nodes (must be array)" };
      }

      if (!Array.isArray(parsed.edges)) {
        return { success: false, error: "Missing or invalid field: edges (must be array)" };
      }

      // Validate nodes
      for (let i = 0; i < parsed.nodes.length; i++) {
        const node = parsed.nodes[i];
        const nodeError = this.validateNode(node, i);
        if (nodeError) {
          return { success: false, error: nodeError };
        }
      }

      // Validate edges
      const nodeIds: Set<string> = new Set();
      parsed.nodes.forEach((n: any) => {
        if (typeof n.id === 'string') {
          nodeIds.add(n.id);
        }
      });
      
      for (let i = 0; i < parsed.edges.length; i++) {
        const edge = parsed.edges[i];
        const edgeError = this.validateEdge(edge, nodeIds, i);
        if (edgeError) {
          return { success: false, error: edgeError };
        }
      }

      return { success: true, data: parsed as FlowData };
    } catch (error) {
      return { 
        success: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  serialize(flowData: FlowData): string {
    return JSON.stringify(flowData, null, 2);
  }

  private validateNode(node: any, index: number): string | null {
    if (!node.id) {
      return `Node ${index}: Missing required field: id`;
    }

    if (typeof node.id !== 'string') {
      return `Node ${index}: Field 'id' must be a string`;
    }

    if (!node.type) {
      return `Node ${index}: Missing required field: type`;
    }

    const validTypes = ['trigger', 'prompt', 'agent-task', 'human-in-the-loop', 'custom'];
    if (!validTypes.includes(node.type)) {
      return `Node ${index}: Invalid type '${node.type}'. Must be one of: ${validTypes.join(', ')}`;
    }

    if (!node.label) {
      return `Node ${index}: Missing required field: label`;
    }

    if (!node.position || typeof node.position !== 'object') {
      return `Node ${index}: Missing or invalid field: position (must be object)`;
    }

    if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      return `Node ${index}: Position must have numeric x and y coordinates`;
    }

    if (node.status) {
      const validStatuses: StepStatus[] = ['pending', 'running', 'success', 'error'];
      if (!validStatuses.includes(node.status)) {
        return `Node ${index}: Invalid status '${node.status}'. Must be one of: ${validStatuses.join(', ')}`;
      }
    }

    return null;
  }

  private validateEdge(edge: any, nodeIds: Set<string>, index: number): string | null {
    if (!edge.id) {
      return `Edge ${index}: Missing required field: id`;
    }

    if (!edge.source) {
      return `Edge ${index}: Missing required field: source`;
    }

    if (!edge.target) {
      return `Edge ${index}: Missing required field: target`;
    }

    if (!nodeIds.has(edge.source)) {
      return `Edge ${index}: Source node '${edge.source}' does not exist`;
    }

    if (!nodeIds.has(edge.target)) {
      return `Edge ${index}: Target node '${edge.target}' does not exist`;
    }

    return null;
  }
}

// Auto-layout utility for nodes without positions
export function autoLayoutNodes(nodes: FlowNode[]): FlowNode[] {
  const HORIZONTAL_SPACING = 400;

  return nodes.map((node, index) => {
    if (node.position.x === 0 && node.position.y === 0 && index > 0) {
      // Auto-position nodes that don't have explicit positions
      return {
        ...node,
        position: {
          x: index * HORIZONTAL_SPACING,
          y: 0
        }
      };
    }
    return node;
  });
}

// Generate edges between sequential workflow steps
export function generateSequentialEdges(nodes: FlowNode[]): FlowEdge[] {
  const edges: FlowEdge[] = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const sourceNode = nodes[i];
    const targetNode = nodes[i + 1];
    
    edges.push({
      id: `${sourceNode.id}-${targetNode.id}`,
      source: sourceNode.id,
      target: targetNode.id,
      animated: sourceNode.status === 'running' || targetNode.status === 'running',
      type: 'smoothstep',
      style: { 
        stroke: '#1f2937',
        strokeWidth: 2,
      },
      markerEnd: {
        type: 'ArrowClosed',
        color: '#1f2937',
        width: 18,
        height: 18,
      }
    });
  }
  
  return edges;
} 