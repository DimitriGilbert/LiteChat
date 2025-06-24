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
  // Find root (node with no incoming edges)
  const childIds = new Set(edges.map(e => e.target));
  const rootId = nodes.find(n => !childIds.has(n.id))?.id || nodes[0].id;

  const nodeMap: Record<string, any> = Object.fromEntries(nodes.map(n => [n.id, {
    id: n.id,
    label: (n.data as any)?.label || (n.data as any)?.stepName || n.id,
    width: nodeSizeMap[n.id]?.[0] || 180,
    height: nodeSizeMap[n.id]?.[1] || 60,
    children: []
  }]));
  edges.forEach(e => {
    if (nodeMap[e.source] && nodeMap[e.target]) {
      nodeMap[e.source].children.push(nodeMap[e.target]);
    }
  });
  return nodeMap[rootId];
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
  // Use maxWidth/maxHeight for all nodes in layout
  const treeLayout = tree<any>().nodeSize([maxWidth, maxHeight]);
  treeLayout(rootHierarchy);

  // Map positions back to nodes
  const posMap: Record<string, { x: number; y: number }> = {};
  rootHierarchy.each((d: any) => {
    posMap[d.data.id] = { x: d.x, y: d.y };
  });

  return nodes.map(n => ({
    ...n,
    position: posMap[n.id] || { x: 0, y: 0 },
  }));
} 