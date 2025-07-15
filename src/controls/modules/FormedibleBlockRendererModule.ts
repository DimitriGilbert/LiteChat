import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { FormedibleBlockRenderer } from "@/components/LiteChat/common/FormedibleBlockRenderer";
import React from "react";

// Control rule prompt for Formedible code blocks - extracted from system prompt for easy modification
export const FORMEDIBLE_CONTROL_PROMPT = `For guided deterministic interaction with the user through a form, you can use the \`formedible\` codeblock.
If you need to get precise information from the user you can use the \`formedible\` codeblock.

**Functionality:**
- The \`formedible\` block interprets a JavaScript object literal that defines a form structure.
- It supports multi-page forms, various input field types (text, number, select, checkbox, etc.), progress indicators, and labels.
- For security reasons, the rendered forms are **read-only** and **cannot execute any custom code or callback functions** (like \`onSubmit\`). Their primary purpose is for previewing and understanding form layouts and data structures.

**Usage:**
To generate a formedible block, enclose your form definition within a markdown code block with the language identifier \`formedible\`.

**Expected Content Format:**
The content inside the \`formedible\` block must be a single JavaScript object literal containing the form's configuration. This object can include the following top-level keys:
- \`schema\`: A \`z.object()\` definition (e.g., \`z.object({ fieldName: z.string().min(1) })\`). You can use basic Zod types. Complex Zod methods or custom functions are not supported and will be ignored or cause parsing errors.
- \`fields\`: An array of field objects. Each field object requires \`name\` (string) and \`type\` (string). Supported types are: \`text\`, \`email\`, \`password\`, \`url\`, \`tel\`, \`textarea\`, \`select\`, \`checkbox\`, \`switch\`, \`number\`, \`date\`, \`slider\`, \`file\`. Additional properties like \`label\`, \`placeholder\`, \`description\`, \`options\`, \`min\`, \`max\`, \`step\`, \`accept\`, \`multiple\`, and \`page\` can be included.
- \`pages\`: (Optional) An array of page objects for multi-page forms. Each page object requires \`page\` (number). \`title\` and \`description\` are optional.
- \`progress\`: (Optional) An object to configure the progress bar, e.g., \`{ showSteps: true, showPercentage: true }\`.
- \`submitLabel\`, \`nextLabel\`, \`previousLabel\`: (Optional) Strings for navigation button labels.
- \`formClassName\`, \`fieldClassName\`: (Optional) Strings for CSS classes.
- \`formOptions\`: (Optional) An object for basic form options. Only \`defaultValues\`, \`asyncDebounceMs\`, and \`canSubmitWhenInvalid\` are supported. Any \`onSubmit\` or other callback functions will be ignored and replaced with a disabled toast message.

**Examples:**

simple: 
\`\`\`formedible
{
  schema: z.object({
    taskName: z.string().min(3, "Task name is required"),
    priority: z.enum(["low", "medium", "high"]),
    dueDate: z.string().optional(),
    isCompleted: z.boolean(),
  }),
  fields: [
    { name: "taskName", type: "text", label: "Task Name", placeholder: "e.g., Finish report" },
    { name: "priority", type: "select", label: "Priority", options: ["low", "medium", "high"] },
    { name: "dueDate", type: "date", label: "Due Date" },
    { name: "isCompleted", type: "checkbox", label: "Mark as Completed" },
  ],
  submitLabel: "Save Task",
  formOptions: {
    defaultValues: {
      taskName: "",
      priority: "medium",
      isCompleted: false,
    }
  }
}
\`\`\`
with pages :
\`\`\`formedible
{
  schema: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email"),
    age: z.number().min(18, "Must be 18 or older"),
    bio: z.string().min(10, "Bio must be at least 10 characters"),
    notifications: z.boolean(),
  }),
  fields: [
    { name: "firstName", type: "text", label: "First Name", page: 1 },
    { name: "lastName", type: "text", label: "Last Name", page: 1 },
    { name: "email", type: "email", label: "Email", page: 2 },
    { name: "age", type: "number", label: "Age", min: 18, max: 120, page: 2 },
    { name: "bio", type: "textarea", label: "Bio", page: 3 },
    { name: "notifications", type: "switch", label: "Enable notifications", page: 3 },
  ],
  pages: [
    { page: 1, title: "Personal Info", description: "Tell us about yourself" },
    { page: 2, title: "Contact Details", description: "How can we reach you?" },
    { page: 3, title: "Preferences", description: "Customize your experience" },
  ],
  progress: { showSteps: true, showPercentage: true },
  nextLabel: "Continue →",
  previousLabel: "← Back",
  submitLabel: "Complete Registration",
  formOptions: {
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      age: 18,
      bio: "",
      notifications: true,
    },
  },
}
\`\`\``;

export class FormedibleBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-formedible";
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

    const formedibleBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["formedible"], // Specifically handles formedible language
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(FormedibleBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(formedibleBlockRenderer);

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Formedible Code Block Control",
      content: FORMEDIBLE_CONTROL_PROMPT,
      description: "Enables AI to generate interactive forms and UI components",
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