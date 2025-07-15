import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { WorkflowBlockRenderer } from "@/components/LiteChat/common/WorkflowBlockRenderer";
import React from "react";

// Control rule prompt for Workflow code blocks
export const WORKFLOW_CONTROL_PROMPT = `LiteChat supports interactive workflow definitions using the \`workflow\` or \`wf\` codeblock. These allow users to save, edit, and run complex multi-step AI workflows directly from the chat interface.

**Functionality:**
- The \`workflow\` block interprets a JSON object that defines a complete WorkflowTemplate
- Users can save workflows to the database for reuse
- Workflows can be edited using the built-in WorkflowBuilder
- Workflows can be executed directly with temporary database entries
- Supports all workflow step types: prompt, agent-task, transform, tool-call, custom-prompt, function, human-in-the-loop, parallel, sub-workflow

**Usage:**
To generate a workflow, enclose your workflow definition within a markdown code block with the language identifier \`workflow\` or \`wf\`.

**Expected Content Format:**
The content inside the \`workflow\` block must be a valid JSON object containing a WorkflowTemplate structure with the following properties:

**Required Fields:**
- \`name\`: (string) The workflow name
- \`description\`: (string) Description of what the workflow does
- \`steps\`: (array) Array of WorkflowStep objects

**Optional Fields:**
- \`id\`: (string) Unique identifier (auto-generated if not provided)
- \`triggerType\`: (string) One of 'custom', 'template', 'task'
- \`triggerRef\`: (string) Reference to template or task ID
- \`triggerPrompt\`: (string) Custom trigger prompt
- \`templateVariables\`: (object) Values for template variables
- \`isShortcut\`: (boolean) Whether this is a shortcut workflow
- \`createdAt\`: (string) ISO 8601 timestamp (auto-generated if not provided)
- \`updatedAt\`: (string) ISO 8601 timestamp (auto-generated if not provided)

**WorkflowStep Structure:**
Each step in the \`steps\` array must have:
- \`id\`: (string) Unique step identifier (auto-generated if not provided)
- \`name\`: (string) Human-readable step name
- \`type\`: (string) Step type - one of: 'trigger', 'prompt', 'agent-task', 'transform', 'tool-call', 'custom-prompt', 'function', 'human-in-the-loop', 'parallel', 'sub-workflow'

**Step Type Specific Fields:**
- **prompt/agent-task**: \`templateId\`, \`modelId\`
- **custom-prompt**: \`promptContent\`, \`promptVariables\`, \`modelId\`
- **transform**: \`transformMappings\` (object with field -> JSONPath mappings)
- **tool-call**: \`toolName\`, \`toolArgs\`
- **function**: \`functionLanguage\` ('js' or 'py'), \`functionCode\`, \`functionVariables\`
- **human-in-the-loop**: \`instructionsForHuman\`
- **parallel**: \`parallelOn\`, \`parallelStep\`, \`parallelModelVar\`
- **sub-workflow**: \`subWorkflowTemplateId\`, \`subWorkflowInputMapping\`

**Common Step Fields:**
- \`inputMapping\`: (object) Map previous step output to this step's input variables
- \`structuredOutput\`: (object) Expected output schema
- \`prompt\`: (string) Denormalized prompt template

**Examples:**

Simple workflow:
\`\`\`workflow
{
  "name": "Content Analysis",
  "description": "Analyze content and generate summary",
  "steps": [
    {
      "name": "Analyze Content",
      "type": "custom-prompt",
      "promptContent": "Analyze the following content and provide key insights: {{content}}",
      "promptVariables": [
        {
          "name": "content",
          "type": "text",
          "required": true,
          "description": "Content to analyze"
        }
      ]
    },
    {
      "name": "Generate Summary",
      "type": "custom-prompt",
      "promptContent": "Based on the analysis: {{analysis}}, create a concise summary",
      "inputMapping": {
        "analysis": "$.output"
      }
    }
  ]
}
\`\`\`

Multi-step workflow with different step types:
\`\`\`workflow
{
  "name": "Research and Report",
  "description": "Research a topic and generate a comprehensive report",
  "steps": [
    {
      "name": "Web Search",
      "type": "tool-call",
      "toolName": "web_search",
      "toolArgs": {
        "query": "{{topic}} latest developments"
      }
    },
    {
      "name": "Extract Key Points",
      "type": "transform",
      "transformMappings": {
        "searchResults": "$.results",
        "keyPoints": "$.results[*].summary"
      }
    },
    {
      "name": "Human Review",
      "type": "human-in-the-loop",
      "instructionsForHuman": "Please review the search results and key points. Add any additional context or corrections."
    },
    {
      "name": "Generate Report",
      "type": "custom-prompt",
      "promptContent": "Create a comprehensive report on {{topic}} using these key points: {{keyPoints}} and human feedback: {{humanFeedback}}",
      "inputMapping": {
        "keyPoints": "$.keyPoints",
        "humanFeedback": "$.humanReview"
      },
      "structuredOutput": {
        "schema": {
          "title": "string",
          "summary": "string",
          "keyFindings": "array",
          "recommendations": "array"
        }
      }
    }
  ],
  "triggerType": "custom",
  "triggerPrompt": "Research and create a report about: {{topic}}"
}
\`\`\`

Parallel processing workflow:
\`\`\`workflow
{
  "name": "Multi-Model Analysis",
  "description": "Analyze content using multiple AI models in parallel",
  "steps": [
    {
      "name": "Parallel Analysis",
      "type": "parallel",
      "parallelOn": "models",
      "parallelModelVar": "modelId",
      "parallelStep": {
        "name": "Model Analysis",
        "type": "custom-prompt",
        "promptContent": "Analyze this content from your perspective: {{content}}",
        "inputMapping": {
          "content": "$.input.content"
        }
      }
    },
    {
      "name": "Synthesize Results",
      "type": "custom-prompt",
      "promptContent": "Synthesize these different analyses into a unified perspective: {{analyses}}",
      "inputMapping": {
        "analyses": "$.parallelResults[*].output"
      }
    }
  ]
}
\`\`\`

**Important Notes:**
- All workflows are saved to the database when using the save button
- Workflows can be run immediately using the run button
- The edit button opens the workflow in the visual WorkflowBuilder
- Step IDs and workflow IDs are auto-generated if not provided
- Timestamps are auto-generated if not provided
- Input mapping uses JSONPath syntax to extract data from previous steps
- Structured output helps ensure consistent data flow between steps`;

export class WorkflowBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-workflow";
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

    const workflowBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["workflow", "wf"], // Handles both workflow and wf language identifiers
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(WorkflowBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(workflowBlockRenderer);

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Workflow Code Block Control",
      content: WORKFLOW_CONTROL_PROMPT,
      description: "Enables AI to generate interactive workflow definitions that can be saved, edited, and executed",
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