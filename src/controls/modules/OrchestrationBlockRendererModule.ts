import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { OrchestrationBlockRenderer } from "@/components/LiteChat/common/OrchestrationBlockRenderer";
import React from "react";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import type { PromptTemplate } from "@/types/litechat/prompt-template";

const TEMPLATE_LIBRARY_RULE_ID = "orchestration-template-library-control-rule";
const MAIN_RULE_ID = "core-block-renderer-orchestration-control-rule";

function formatTemplateList(templates: PromptTemplate[]): string {
  // Output a plain JSON array for AI parsing
  return JSON.stringify(templates.map(t => ({
    id: t.id,
    name: t.name,
    type: t.type || "prompt",
    variables: t.variables,
    description: t.description,
    tags: t.tags,
    isShortcut: t.isShortcut,
    isPublic: t.isPublic
  })), null, 2);
}

function getCanonicalExamples(): string {
  return `
### Example 1: Mars Color Explanation

\u0060\u0060\u0060orchestration
{
  "id": "KTP4-gVubXkznj-TNw-qZ",
  "name": "why is mars red",
  "description": "explain color of mars and simulate",
  "steps": [
    {
      "id": "step_1750238527413_0",
      "name": "make it python",
      "type": "transform",
      "modelId": "wDGr_e9ASG1e4J7O6OlHp:meta-llama/llama-4-scout:free",
      "transformMappings": {
        "the_question": "$.workflow.triggerPrompt",
        "explanation": "$.outputs[0]"
      }
    },
    {
      "id": "sghWWQADFTEbZBMnEql24",
      "name": "simulate",
      "type": "prompt",
      "modelId": "wDGr_e9ASG1e4J7O6OlHp:moonshotai/kimi-dev-72b:free",
      "templateId": "mL_lWwDbqSMUR2TbdFKNG"
    }
  ],
  "createdAt": "2025-06-18T15:19:36.587Z",
  "updatedAt": "2025-06-28T13:38:16.769Z",
  "triggerType": "template",
  "triggerPrompt": "Why is Mars red ?",
  "triggerRef": "h4uShBJAE5235hK4hrGBc",
  "templateVariables": {
    "what": "Mars",
    "color": "red"
  },
  "isShortcut": true
}
\u0060\u0060\u0060

### Example 2: Python Lint/Validate Output

\u0060\u0060\u0060orchestration
{
  "id": "lint-python-eg-1",
  "name": "Python Output Lint",
  "description": "Lint and validate a generated Python code output.",
  "steps": [
    {
      "id": "step1",
      "type": "prompt",
      "modelId": "wDGr_e9ASG1e4J7O6OlHp:meta-llama/llama-4-scout:free",
      "templateId": "<your-template-id>",
      "outputVar": "generated_code"
    },
    {
      "id": "step2",
      "type": "code",
      "language": "python",
      "code": "import ast\ntry:\n  ast.parse(generated_code)\n  print('VALID')\nexcept Exception as e:\n  print('INVALID:', e)",
      "inputVar": "generated_code",
      "outputVar": "lint_result"
    }
  ],
  "createdAt": "2025-06-18T15:19:36.587Z",
  "updatedAt": "2025-06-28T13:38:16.769Z",
  "triggerType": "template",
  "triggerPrompt": "Write a Python function to compute the nth Fibonacci number.",
  "triggerRef": "<your-trigger-template-id>",
  "templateVariables": {
    "n": 10
  },
  "isShortcut": false
}
\u0060\u0060\u0060`;
}

function getMainRuleContent(): string {
  return `# Orchestration Workflow Block (LLM Guide)

You can output a workflow definition using a markdown code block with the language identifier \u0060orchestration\u0060.

## Step Types
- **prompt**: Runs a prompt template. Fields: \u0060templateId\u0060, \u0060modelId\u0060, \u0060outputVar\u0060 (optional).
- **transform**: Runs a transform step. Fields: \u0060modelId\u0060, \u0060transformMappings\u0060 (object mapping output fields).
- **code**: Runs code in a language. Fields: \u0060language\u0060, \u0060code\u0060, \u0060inputVar\u0060, \u0060outputVar\u0060.

## Referencing Templates
- Use \u0060templateId\u0060 to reference a prompt, agent, or task from the [Orchestration Template Library] control rule (see below).
- Do **not** include the full template list in your block—just reference by ID.

## Variable Passing
- Use \u0060outputVar\u0060 to name the output of a step.
- Use \u0060inputVar\u0060 to consume the output of a previous step.
- You can pass objects as input/output.

## Canonical Examples
${getCanonicalExamples()}

## Template Discovery
- To discover available prompt/agent/task templates, consult the always-up-to-date [Orchestration Template Library] control rule.
`;
}

export class OrchestrationBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-orchestration";
  private unregisterCallback?: () => void;
  private unregisterMainRuleCallback?: () => void;
  private unregisterTemplateRuleCallback?: () => void;
  private modApi?: LiteChatModApi;
  private templateListenerUnsub?: () => void;

  async initialize(): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.modApi = modApi;
    const orchestrationBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["orchestration"],
      priority: 10,
      renderer: (context: BlockRendererContext) => {
        return React.createElement(OrchestrationBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming ?? false,
        });
      },
    };
    this.unregisterCallback = modApi.registerBlockRenderer(orchestrationBlockRenderer);
    this.registerOrUpdateRules();
    // Listen for template changes and update the template rule in real time
    this.templateListenerUnsub = () => {
      emitter.off(promptTemplateEvent.promptTemplatesChanged, this.handleTemplatesChanged);
      emitter.off(promptTemplateEvent.promptTemplateAdded, this.handleTemplatesChanged);
      emitter.off(promptTemplateEvent.promptTemplateUpdated, this.handleTemplatesChanged);
      emitter.off(promptTemplateEvent.promptTemplateDeleted, this.handleTemplatesChanged);
    };
    this.handleTemplatesChanged = this.handleTemplatesChanged.bind(this);
    emitter.on(promptTemplateEvent.promptTemplatesChanged, this.handleTemplatesChanged);
    emitter.on(promptTemplateEvent.promptTemplateAdded, this.handleTemplatesChanged);
    emitter.on(promptTemplateEvent.promptTemplateUpdated, this.handleTemplatesChanged);
    emitter.on(promptTemplateEvent.promptTemplateDeleted, this.handleTemplatesChanged);
  }

  private handleTemplatesChanged() {
    this.registerOrUpdateRules();
  }

  private registerOrUpdateRules() {
    const templates = usePromptTemplateStore.getState().promptTemplates;
    // Unregister previous rules if present
    if (this.unregisterMainRuleCallback) this.unregisterMainRuleCallback();
    if (this.unregisterTemplateRuleCallback) this.unregisterTemplateRuleCallback();
    // Register main rule
    this.unregisterMainRuleCallback = this.modApi?.registerRule({
      id: MAIN_RULE_ID,
      name: "Orchestration Workflow Block Control",
      content: getMainRuleContent(),
      type: "control",
      alwaysOn: true,
      moduleId: this.id,
    });
    // Register template library rule
    this.unregisterTemplateRuleCallback = this.modApi?.registerRule({
      id: TEMPLATE_LIBRARY_RULE_ID,
      name: "Orchestration Template Library",
      content: formatTemplateList(templates),
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
    if (this.unregisterMainRuleCallback) {
      this.unregisterMainRuleCallback();
      this.unregisterMainRuleCallback = undefined;
    }
    if (this.unregisterTemplateRuleCallback) {
      this.unregisterTemplateRuleCallback();
      this.unregisterTemplateRuleCallback = undefined;
    }
    if (this.templateListenerUnsub) {
      this.templateListenerUnsub();
      this.templateListenerUnsub = undefined;
    }
  }
} 