import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { FlowBlockRenderer } from "@/components/LiteChat/common/FlowBlockRenderer";
import React from "react";

// Control rule prompt for Flow diagrams - extracted from system prompt for easy modification
const FLOW_CONTROL_PROMPT = `LiteChat supports interactive workflow flow diagrams using the \`flow\` codeblock. These are particularly useful for visualizing workflows, processes, and step-by-step procedures.
These are very fancy and give amazing result, if you need to explain things graphically, this is your favorite block.

**Functionality:**
- The \`flow\` block interprets a JSON object that defines nodes (steps) and edges (connections) in a workflow
- It renders an interactive React Flow diagram with custom node types for different step types
- Nodes can have different statuses (pending, running, success, error) with visual indicators
- Supports various node types: trigger, prompt, agent-task, human-in-the-loop, and generic steps
- Includes zoom, pan, minimap, and download capabilities

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
- \`type\`: Node type ("trigger", "prompt", "agent-task", "human-in-the-loop", or custom)
- \`label\`: Display label for the node
- \`position\`: Object with \`x\` and \`y\` coordinates
- \`status\`: (Optional) Current status ("pending", "running", "success", "error")
- \`data\`: (Optional) Additional data like \`templateName\`, \`modelName\`, etc.

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
      "position": { "x": 0, "y": 100 },
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
      "position": { "x": 200, "y": 100 },
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
      "position": { "x": 400, "y": 100 },
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
      "position": { "x": 600, "y": 100 },
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
  "name": "Decision Making Process",
  "description": "Company decision approval workflow",
  "background": {
    "variant": "lines",
    "gap": [40, 40],
    "color": "#f3f4f6"
  },
  "nodes": [
    {
      "id": "proposal",
      "type": "input",
      "label": "New Proposal",
      "position": { "x": 200, "y": 0 },
      "style": {
        "backgroundColor": "#eff6ff",
        "borderColor": "#2563eb",
        "borderWidth": 2,
        "borderRadius": 8
      }
    },
    {
      "id": "review",
      "type": "default",
      "label": "Team Review",
      "position": { "x": 200, "y": 150 },
      "style": {
        "backgroundColor": "#fef2f2",
        "borderColor": "#dc2626"
      }
    },
    {
      "id": "approve",
      "type": "default",
      "label": "Manager Approval",
      "position": { "x": 50, "y": 300 },
      "style": {
        "backgroundColor": "#f0fdf4",
        "borderColor": "#16a34a"
      }
    },
    {
      "id": "reject",
      "type": "default",
      "label": "Needs Revision",
      "position": { "x": 350, "y": 300 },
      "style": {
        "backgroundColor": "#fef2f2",
        "borderColor": "#dc2626"
      }
    },
    {
      "id": "implement",
      "type": "output",
      "label": "Implementation",
      "position": { "x": 50, "y": 450 },
      "style": {
        "backgroundColor": "#ecfdf5",
        "borderColor": "#059669"
      }
    },
    {
      "id": "revise",
      "type": "default",
      "label": "Back to Team",
      "position": { "x": 350, "y": 450 },
      "style": {
        "backgroundColor": "#fffbeb",
        "borderColor": "#d97706"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "proposal",
      "target": "review",
      "type": "straight",
      "markerEnd": { "type": "ArrowClosed" }
    },
    {
      "id": "e2",
      "source": "review",
      "target": "approve",
      "type": "smoothstep",
      "label": "Approved",
      "style": { "stroke": "#16a34a" },
      "markerEnd": { "type": "ArrowClosed", "color": "#16a34a" }
    },
    {
      "id": "e3",
      "source": "review",
      "target": "reject",
      "type": "smoothstep",
      "label": "Rejected",
      "style": { "stroke": "#dc2626" },
      "markerEnd": { "type": "ArrowClosed", "color": "#dc2626" }
    },
    {
      "id": "e4",
      "source": "approve",
      "target": "implement",
      "type": "straight",
      "style": { "stroke": "#059669" },
      "markerEnd": { "type": "ArrowClosed", "color": "#059669" }
    },
    {
      "id": "e5",
      "source": "reject",
      "target": "revise",
      "type": "straight",
      "style": { "stroke": "#d97706" },
      "markerEnd": { "type": "ArrowClosed", "color": "#d97706" }
    },
    {
      "id": "e6",
      "source": "revise",
      "target": "review",
      "type": "bezier",
      "style": { 
        "stroke": "#6b7280",
        "strokeDasharray": "5,5"
      },
      "markerEnd": { "type": "Arrow", "color": "#6b7280" }
    }
  ]
}
\`\`\`

Use 'flow', 'workflow', or 'reactflow' language identifiers for interactive React Flow-based rendering with draggable nodes, edges, and controls. Ideal for workflow definitions, process diagrams, and system architecture visualizations.`;

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