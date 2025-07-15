import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { FlowBlockRenderer } from "@/components/LiteChat/common/FlowBlockRenderer";
import React from "react";

// Control rule prompt for Flow diagrams
export const FLOW_CONTROL_PROMPT = `LiteChat supports interactive workflow flow diagrams using the \`flow\` codeblock. These are particularly useful for visualizing workflows, processes, and step-by-step procedures.
These are very fancy and give amazing result, if you need to explain things graphically, this is your favorite block.

**Functionality:**
- The \`flow\` block interprets a JSON object that defines nodes (steps) and edges (connections) in a workflow
- It renders an interactive React Flow diagram with custom node types for different step types
- Nodes can have different statuses (pending, running, success, error) with visual indicators
- Supports various node types: trigger, prompt, agent-task, human-in-the-loop, and generic steps
- Includes zoom, pan, minimap, and download capabilities
- Automatic layout positioning for nodes when coordinates are not specified

**Usage:**
To generate a flow diagram, enclose your flow definition within a markdown code block with the language identifier \`flow\`.

**Expected Content Format:**
The content inside the \`flow\` block must be a valid JSON object containing:
- \`type\`: Usually "workflow" for workflow diagrams
- \`name\`: Display name for the workflow
- \`nodes\`: Array of node objects defining the steps
- \`edges\`: Array of edge objects defining connections between steps

**Node Structure:**
Each node requires:
- \`id\`: Unique identifier for the node
- \`type\`: Node type ('trigger', 'prompt', 'agent-task', 'transform', 'human-in-the-loop', 'custom', 'input', 'output', 'default', 'group') use custom for most you use case !
- \`label\`: Display label for the node (**can be plain text or HTML, including <img> and <svg> for rich content; will be rendered as HTML**)
- \`style\`: (Optional) Styling object
- \`status\`: (Optional) Current status ("pending", "running", "success", "error")
- \`data\`: (Optional) Additional data like \`templateName\`, \`modelName\`, etc.
- \`position\`: (Optional) Object with \`x\` and \`y\` coordinates (optional, automatic layout is prefered)

**Edge Structure:**
Each edge requires:
- \`id\`: Unique identifier for the edge
- \`source\`: ID of the source node
- \`target\`: ID of the target node
- \`type\`: (Optional) Edge type, defaults to "smoothstep"
- \`animated\`: (Optional) Boolean for animation
- \`style\`: (Optional) Styling object

**Examples:**

Simple process flow:
\`\`\`flow
{
  "type": "process",
  "name": "Order Processing System",
  "description": "E-commerce order fulfillment process",
  "background": {
    "variant": "dots",
    "gap": 20,
    "color": "#e5e7eb"
  },
  "nodes": [
    {
      "id": "start",
      "type": "input",
      "label": "New Order",
      "status": "success",
      "style": {
        "backgroundColor": "#dcfce7",
        "borderColor": "#22c55e",
        "color": "#166534"
      }
    },
    {
      "id": "validate",
      "type": "default",
      "label": "Validate Payment",
      "status": "running",
      "style": {
        "backgroundColor": "#dbeafe",
        "borderColor": "#3b82f6",
        "color": "#1e40af"
      }
    },
    {
      "id": "fulfill",
      "type": "default",
      "label": "Ship Order",
      "status": "pending",
      "style": {
        "backgroundColor": "#fef3c7",
        "borderColor": "#f59e0b",
        "color": "#92400e"
      }
    },
    {
      "id": "complete",
      "type": "output",
      "label": "Order Complete",
      "status": "pending",
      "style": {
        "backgroundColor": "#f3e8ff",
        "borderColor": "#8b5cf6",
        "color": "#6b21a8"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "start",
      "target": "validate",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#22c55e",
        "strokeWidth": 2
      },
      "markerEnd": {
        "type": "ArrowClosed",
        "color": "#22c55e"
      }
    },
    {
      "id": "e2",
      "source": "validate",
      "target": "fulfill",
      "type": "smoothstep",
      "style": {
        "stroke": "#3b82f6",
        "strokeWidth": 2
      },
      "markerEnd": {
        "type": "ArrowClosed",
        "color": "#3b82f6"
      }
    },
    {
      "id": "e3",
      "source": "fulfill",
      "target": "complete",
      "type": "smoothstep",
      "style": {
        "stroke": "#6b7280",
        "strokeWidth": 2,
        "strokeDasharray": "5,5"
      },
      "markerEnd": {
        "type": "ArrowClosed",
        "color": "#6b7280"
      }
    }
  ]
}
\`\`\`

Organizational flowchart:
\`\`\`flow
{
  "type": "flowchart",
  "name": "LiteChat Ecosystem",
  "description": "LiteChat as the central hub connecting AI capabilities",
  "background": {
    "variant": "dots",
    "color": "#f0f8ff",
    "gap": 25
  },
  "nodes": [
    {
      "id": "litechat",
      "type": "custom",
      "label": "<img src=\"https://litechat.dbuild.dev/icons/128.png\" />",
      "style": {
        "backgroundColor": "#FFF2CC",
        "borderColor": "#FFD700",
        "borderWidth": 3,
        "width": 160,
        "height": 160,
        "fontSize": 24,
        "color": "#FF6B00",
        "borderRadius": "50%",
        "boxShadow": "0 0 20px rgba(255,215,0,0.7)"
      },
      "position": { "x": 400, "y": 400 },
      "targetPosition": "left"
    },
    {
      "id": "models",
      "type": "default",
      "label": "300+ AI Models",
      "style": {
        "backgroundColor": "#FFD6E7",
        "borderColor": "#FF1493",
        "color": "#C71585",
        "borderWidth": 2,
        "borderRadius": 10,
        "padding": 15
      },
      "position": { "x": 700, "y": 200 },
      "sourcePosition": "right"
    },
    {
      "id": "ui",
      "type": "default",
      "label": "Rich AI UI",
      "style": {
        "backgroundColor": "#D1ECFF",
        "borderColor": "#1E90FF",
        "color": "#0066CC",
        "borderWidth": 2,
        "borderRadius": 10,
        "padding": 15
      },
      "position": { "x": 800, "y": 450 },
      "sourcePosition": "right"
    },
    {
      "id": "tools",
      "type": "default",
      "label": "Tools & MCP",
      "style": {
        "backgroundColor": "#D5F5E3",
        "borderColor": "#2ECC71",
        "color": "#1E8449",
        "borderWidth": 2,
        "borderRadius": 10,
        "padding": 15
      },
      "position": { "x": 700, "y": 700 },
      "sourcePosition": "top"
    },
    {
      "id": "library",
      "type": "default",
      "label": "Prompt & Agents Library",
      "style": {
        "backgroundColor": "#EBDEF0",
        "borderColor": "#9B59B6",
        "color": "#6C3483",
        "borderWidth": 2,
        "borderRadius": 10,
        "padding": 15
      },
      "position": { "x": 100, "y": 700 },
      "sourcePosition": "top"
    },
    {
      "id": "ai-race",
      "type": "default",
      "label": "AI Race",
      "style": {
        "backgroundColor": "#FDEBD0",
        "borderColor": "#F39C12",
        "color": "#D35400",
        "borderWidth": 2,
        "borderRadius": 10,
        "padding": 15
      },
      "position": { "x": 0, "y": 450 },
      "sourcePosition": "left"
    },
    {
      "id": "workflow",
      "type": "default",
      "label": "Workflow Engine",
      "style": {
        "backgroundColor": "#FFE0E0",
        "borderColor": "#E74C3C",
        "color": "#C0392B",
        "borderWidth": 2,
        "borderRadius": 10,
        "padding": 15
      },
      "position": { "x": 100, "y": 200 },
      "sourcePosition": "left"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "target": "litechat",
      "source": "models",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#FF69B4",
        "strokeWidth": 3
      },
      "sourceHandle": "left",
      "targetHandle": "top"
    },
    {
      "id": "e2",
      "target": "litechat",
      "source": "ui",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#1E90FF",
        "strokeWidth": 3
      },
      "sourceHandle": "left",
      "targetHandle": "right"
    },
    {
      "id": "e3",
      "target": "litechat",
      "source": "tools",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#27AE60",
        "strokeWidth": 3
      },
      "sourceHandle": "top",
      "targetHandle": "bottom"
    },
    {
      "id": "e4",
      "target": "litechat",
      "source": "library",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#9B59B6",
        "strokeWidth": 3
      },
      "sourceHandle": "top",
      "targetHandle": "bottom"
    },
    {
      "id": "e5",
      "target": "litechat",
      "source": "ai-race",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#F39C12",
        "strokeWidth": 3
      },
      "sourceHandle": "right",
      "targetHandle": "left"
    },
    {
      "id": "e6",
      "target": "litechat",
      "source": "workflow",
      "type": "smoothstep",
      "animated": true,
      "style": {
        "stroke": "#E74C3C",
        "strokeWidth": 3
      },
      "sourceHandle": "right",
      "targetHandle": "top"
    }
  ]
}
\`\`\`

Use 'flow', 'workflow', or 'reactflow' language identifiers for interactive React Flow-based rendering with draggable nodes, edges, and controls. Ideal for workflow definitions, process diagrams, and system architecture visualizations. Positioning is handled automatically - do not specify x/y coordinates unless you absolutely need specific placement.`;

export class FlowBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-flow";
  private unregisterCallback?: () => void;
  private unregisterRuleCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const flowBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["flow", "workflow", "reactflow"], // Multiple language aliases
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(FlowBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    // console.log(`[FlowBlockRendererModule] Registering flow block renderer with supported languages:`, flowBlockRenderer.supportedLanguages);
    this.unregisterCallback = modApi.registerBlockRenderer(flowBlockRenderer);
    // console.log(`[FlowBlockRendererModule] Flow block renderer registered successfully`);

    // Register control rule for Flow diagrams
    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Flow Diagram Control",
      content: FLOW_CONTROL_PROMPT,
      description: "Enables AI to generate flow diagrams and process visualizations",
      type: "control",
      alwaysOn: true,
      moduleId: this.id,
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
    if (this.unregisterRuleCallback) {
      this.unregisterRuleCallback();
      this.unregisterRuleCallback = undefined;
    }
  }
} 