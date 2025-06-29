import { hierarchy, tree } from 'd3-hierarchy';
import type { Node, Edge } from '@xyflow/react';

// Use Tailwind's text-base (16px), leading-normal (24px), and font-mono (8px per char as a rough estimate)
function estimateNodeSizeFromNode(
  node: Node,
  minWidth = 180,
  charWidth = 8, // for font-mono, adjust for font-sans if needed
  baseHeight = 48, // 2 lines of 24px
  lineHeight = 24
): [number, number] {
  const label = (node.data as any)?.label || (node.data as any)?.stepName || node.id;
  const status = (node.data as any)?.status || '';
  const subtitle = (node.data as any)?.subtitle || (node.data as any)?.modelName || '';
  // Description can be in data.description or data.data.description
  const description = (node.data as any)?.description || (node.data as any)?.data?.description || '';
  // Add any other fields you render in the node here

  // Compose all lines that are rendered
  const lines = [label, subtitle, status, description].filter(Boolean);

  // Use the longest line for width, and count lines for height
  const width = Math.max(minWidth, ...lines.map(line => ('' + line).length * charWidth));
  const height = baseHeight + (lines.length - 2) * lineHeight; // baseHeight is for 2 lines

  // Optionally, add extra width/height for icons, badges, etc.
  return [width, height];
}

// Helper to build a tree from flat nodes/edges, using only id, children, width, height
function buildTree(nodes: Node[], edges: Edge[], nodeSizeMap: Record<string, [number, number]>): any {
  if (!nodes.length) return null;
  
  // Build adjacency lists
  const children: Record<string, any[]> = {};
  const parents: Record<string, string[]> = {};
  const nodeMap: Record<string, any> = {};
  
  // Initialize node map
  nodes.forEach(n => {
    const nodeId = n.id;
    nodeMap[nodeId] = {
      id: nodeId,
      label: (n.data as any)?.label || (n.data as any)?.stepName || nodeId,
      width: nodeSizeMap[nodeId]?.[0] || 180,
      height: nodeSizeMap[nodeId]?.[1] || 60,
      children: []
    };
    children[nodeId] = [];
    parents[nodeId] = [];
  });
  
  // Build relationships
  edges.forEach(e => {
    if (nodeMap[e.source] && nodeMap[e.target]) {
      children[e.source].push(nodeMap[e.target]);
      parents[e.target].push(e.source);
    }
  });
  
  // Find root nodes (nodes with no parents)
  const rootCandidates = nodes.filter(n => parents[n.id].length === 0);
  
  if (rootCandidates.length === 0) {
    // Handle circular references by picking the first node
    return nodeMap[nodes[0].id];
  }
  
  if (rootCandidates.length === 1) {
    // Single root - standard tree
    const root = nodeMap[rootCandidates[0].id];
    root.children = children[root.id];
    return root;
  }
  
  // Multiple roots - create virtual root
  const virtualRoot = {
    id: '__virtual_root__',
    label: '',
    width: 0,
    height: 0,
    children: rootCandidates.map(n => {
      const node = nodeMap[n.id];
      node.children = children[n.id];
      return node;
    })
  };
  
  return virtualRoot;
}

export function getTreeLayout(nodes: Node[], edges: Edge[], defaultNodeSize: [number, number] = [220, 120]) {
  // Build a size map for each node using improved estimation
  const nodeSizeMap: Record<string, [number, number]> = {};
  let maxWidth = defaultNodeSize[0];
  let maxHeight = defaultNodeSize[1];
  nodes.forEach(n => {
    const [w, h] = estimateNodeSizeFromNode(n, defaultNodeSize[0], 8, defaultNodeSize[1]);
    nodeSizeMap[n.id] = [w, h];
    if (w > maxWidth) maxWidth = w;
    if (h > maxHeight) maxHeight = h;
  });

  const root = buildTree(nodes, edges, nodeSizeMap);
  if (!root) return nodes;

  const rootHierarchy = hierarchy<any>(root);
  // Use dynamic spacing based on node sizes
  const spacingX = maxWidth + 50; // Add some padding
  const spacingY = maxHeight + 40;
  const treeLayout = tree<any>().nodeSize([spacingX, spacingY]);
  treeLayout(rootHierarchy);

  // Map positions back to nodes
  const posMap: Record<string, { x: number; y: number }> = {};
  rootHierarchy.each((d: any) => {
    // Skip virtual root positioning
    if (d.data.id !== '__virtual_root__') {
      posMap[d.data.id] = { x: d.x, y: d.y };
    }
  });

  // If we have a virtual root, adjust positions to center the layout
  if (root.id === '__virtual_root__') {
    const positions = Object.values(posMap);
    if (positions.length > 0) {
      const minX = Math.min(...positions.map(p => p.x));
      const maxX = Math.max(...positions.map(p => p.x));
      const minY = Math.min(...positions.map(p => p.y));
      const centerX = (minX + maxX) / 2;
      
      // Center the layout and move it down from the virtual root
      Object.keys(posMap).forEach(id => {
        posMap[id].x -= centerX;
        posMap[id].y -= minY - spacingY; // Move up by one level
      });
    }
  }

  return nodes.map(n => ({
    ...n,
    position: posMap[n.id] || { x: 0, y: 0 },
  }));
} 