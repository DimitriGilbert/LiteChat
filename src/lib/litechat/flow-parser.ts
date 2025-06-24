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
        const nodeError = this.validateNode(node, i, parsed.nodes);
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

  private validateNode(node: any, index: number, allNodes: any[]): string | null {
    if (!node.id) {
      return `Node ${index}: Missing required field: id`;
    }
    
    if (typeof node.id !== 'string') {
      return `Node ${index}: Field 'id' must be a string`;
    }
    
    if (!node.type) {
      return `Node ${index}: Missing required field: type`;
    }

    if (!node.label) {
      return `Node ${index}: Missing required field: label`;
    }

    // Position is optional - if not provided, auto-layout will handle it
    if (node.position && typeof node.position === 'object') {
      if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        return `Node ${index}: Invalid position - must have x and y as numbers`;
      }
    }

    // Check for duplicate IDs
    const idCount = allNodes.filter(n => n.id === node.id).length;
    if (idCount > 1) {
      return `Node ${index}: Duplicate ID '${node.id}' - IDs must be unique`;
    }

    // Check if type is valid
    const validTypes = [
      'trigger', 'prompt', 'agent-task', 'transform', 'human-in-the-loop', 'custom',
      'input', 'output', 'default', 'group'
    ];
    if (!validTypes.includes(node.type) && !node.type.startsWith('custom-')) {
      console.warn(`Node ${index}: Unrecognized type '${node.type}' - consider using standard types or prefixing with 'custom-'`);
    }

    if (node.status) {
      const validStatuses: StepStatus[] = ['pending', 'running', 'success', 'error'];
      if (!validStatuses.includes(node.status)) {
        return `Node ${index}: Invalid status '${node.status}'. Must be one of: ${validStatuses.join(', ')}`;
      }
    }

    // Validate styling options
    if (node.style && typeof node.style !== 'object') {
      return `Node ${index}: Style must be an object`;
    }

    if (node.style) {
      const validStyleKeys = [
        'background', 'backgroundColor', 'color', 'border', 'borderColor', 'borderWidth', 'borderRadius',
        'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
        'padding', 'margin', 'fontSize', 'fontWeight', 'opacity', 'boxShadow'
      ];
      
      for (const key in node.style) {
        if (!validStyleKeys.includes(key)) {
          return `Node ${index}: Invalid style property '${key}'. Valid properties: ${validStyleKeys.join(', ')}`;
        }
      }
    }

    // Validate className
    if (node.className && typeof node.className !== 'string') {
      return `Node ${index}: className must be a string`;
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

    // Validate edge type
    if (edge.type) {
      const validEdgeTypes = ['default', 'straight', 'step', 'smoothstep', 'bezier', 'custom'];
      if (!validEdgeTypes.includes(edge.type)) {
        return `Edge ${index}: Invalid type '${edge.type}'. Must be one of: ${validEdgeTypes.join(', ')}`;
      }
    }

    // Validate styling options
    if (edge.style && typeof edge.style !== 'object') {
      return `Edge ${index}: Style must be an object`;
    }

    if (edge.style) {
      const validStyleKeys = [
        'stroke', 'strokeWidth', 'strokeDasharray', 'strokeOpacity',
        'fill', 'color', 'opacity'
      ];
      
      for (const key in edge.style) {
        if (!validStyleKeys.includes(key)) {
          return `Edge ${index}: Invalid style property '${key}'. Valid properties: ${validStyleKeys.join(', ')}`;
        }
      }
    }

    // Validate markers
    if (edge.markerEnd) {
      const markerError = this.validateMarker(edge.markerEnd, `Edge ${index} markerEnd`);
      if (markerError) return markerError;
    }

    if (edge.markerStart) {
      const markerError = this.validateMarker(edge.markerStart, `Edge ${index} markerStart`);
      if (markerError) return markerError;
    }

    return null;
  }

  private validateMarker(marker: any, context: string): string | null {
    if (typeof marker === 'string') {
      // Custom marker reference is valid
      return null;
    }

    if (typeof marker !== 'object') {
      return `${context}: Marker must be an object or string`;
    }

    if (marker.type) {
      const validMarkerTypes = ['Arrow', 'ArrowClosed'];
      if (!validMarkerTypes.includes(marker.type)) {
        return `${context}: Invalid marker type '${marker.type}'. Must be one of: ${validMarkerTypes.join(', ')}`;
      }
    }

    // Validate marker properties
    if (marker.width && typeof marker.width !== 'number') {
      return `${context}: Marker width must be a number`;
    }

    if (marker.height && typeof marker.height !== 'number') {
      return `${context}: Marker height must be a number`;
    }

    if (marker.color && typeof marker.color !== 'string') {
      return `${context}: Marker color must be a string`;
    }

    return null;
  }
}

// Auto-layout utility for nodes without positions
export function autoLayoutNodes(nodes: FlowNode[]): FlowNode[] {
  const HORIZONTAL_SPACING = 400;
  const VERTICAL_SPACING = 150;

  return nodes.map((node, index) => {
    // If position is missing, or x/y are not numbers, auto-layout
    if (
      !node.position ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number'
    ) {
      const row = Math.floor(index / 3);
      const col = index % 3;
      return {
        ...node,
        position: {
          x: col * HORIZONTAL_SPACING,
          y: row * VERTICAL_SPACING,
        },
      };
    }
    // Otherwise, use the provided position
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
        stroke: getEdgeColor(sourceNode.status),
        strokeWidth: 2,
      },
      markerEnd: {
        type: 'ArrowClosed',
        color: getEdgeColor(sourceNode.status),
        width: 18,
        height: 18,
      }
    });
  }
  
  return edges;
}

// Helper function to get edge color based on status
function getEdgeColor(status?: StepStatus): string {
  switch (status) {
    case 'success':
      return '#22c55e'; // green
    case 'error':
      return '#ef4444'; // red
    case 'running':
      return '#3b82f6'; // blue
    case 'pending':
    default:
      return '#6b7280'; // gray
  }
}

// Generate a radial layout for nodes
export function generateRadialLayout(nodes: FlowNode[], centerX = 400, centerY = 300, radius = 200): FlowNode[] {
  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) {
    return [{ ...nodes[0], position: { x: centerX, y: centerY } }];
  }

  const angleStep = (2 * Math.PI) / nodes.length;
  
  return nodes.map((node, index) => {
    const angle = index * angleStep;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    return {
      ...node,
      position: { x, y }
    };
  });
}

// Generate a grid layout for nodes
export function generateGridLayout(nodes: FlowNode[], columns = 3, cellWidth = 300, cellHeight = 200): FlowNode[] {
  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    
    return {
      ...node,
      position: {
        x: col * cellWidth,
        y: row * cellHeight
      }
    };
  });
} 