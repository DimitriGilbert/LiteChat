import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import {
  RepairEnhanceCodeBlockControl,
  type RepairEnhanceCodeBlockControlProps,
} from "@/controls/components/canvas/codeblock/RepairEnhanceCodeBlockControl";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { nanoid } from "nanoid";
import type { Interaction } from "@/types/litechat/interaction";
import {
  instantiateModelInstance,
  splitModelId,
} from "@/lib/litechat/provider-helpers";
import { toast } from "sonner";
import MarkdownIt from "markdown-it";
import { AIService } from "@/services/ai.service";
import { emitter } from "@/lib/litechat/event-emitter";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { JS_RUNNABLE_CONTROL_PROMPT } from "@/controls/modules/JsRunnableBlockRendererModule";
import { PYTHON_RUNNABLE_CONTROL_PROMPT } from "@/controls/modules/PythonRunnableBlockRendererModule";
import { MERMAID_CONTROL_PROMPT } from "@/controls/modules/MermaidBlockRendererModule";
import { FLOW_CONTROL_PROMPT } from "@/controls/modules/FlowBlockRendererModule";
import { FORMEDIBLE_CONTROL_PROMPT } from "@/controls/modules/FormedibleBlockRendererModule";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

export class UniversalRepairEnhanceControlModule implements ControlModule {
  readonly id = "core-universal-repair-enhance";

  private eventUnsubscribers: (() => void)[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    const unsubRepairEnhance = modApi.on(
      canvasEvent.repairEnhanceCodeBlockRequest,
      async (payload) => {
        await this.handleRepairEnhanceRequest(
          payload.interactionId,
          payload.codeBlockId,
          payload.language,
          payload.filepath,
          payload.originalContent,
          payload.mode,
          payload.errorMessage
        );
      }
    );

    this.eventUnsubscribers.push(unsubRepairEnhance);
  }

  private getSmartPrompts(
    language: string,
    mode:
      | "repair"
      | "enhance"
      | "complete-message"
      | "complete-conversation"
      | "other-blocks-message"
      | "other-blocks-conversation",
    originalContent: string,
    contextPrompt: string,
    errorMessage?: string
  ) {
    const action = mode.startsWith("enhance") ? "enhance" : "repair";

    let systemPrompt = "";
    const taskDescription =
      action === "repair"
        ? `Fix the broken code provided.`
        : `Enhance the code provided by adding better error handling, documentation, optimization, and best practices, while maintaining the original functionality.`;

    const baseSystem = `You are an expert ${language} developer. ${taskDescription} Return ONLY the corrected code without any explanations, markdown formatting, or additional text.`;

    // Use specific, imported LiteChat control prompts ONLY for their designated languages.
    switch (language) {
      case "runjs":
        systemPrompt = JS_RUNNABLE_CONTROL_PROMPT;
        break;
      case "runpy":
        systemPrompt = PYTHON_RUNNABLE_CONTROL_PROMPT;
        break;
      case "mermaid":
        systemPrompt = MERMAID_CONTROL_PROMPT;
        break;
      case "flow":
        systemPrompt = FLOW_CONTROL_PROMPT;
        break;
      case "formedible":
        systemPrompt = FORMEDIBLE_CONTROL_PROMPT;
        break;
      // All other languages use the generic "expert" prompt.
      default:
        systemPrompt = baseSystem;
    }

    const userPrompt = `TASK: ${
      action.charAt(0).toUpperCase() + action.slice(1)
    } the following code block.
${errorMessage ? `The block has the following error: ${errorMessage}\n` : ""}
Return ONLY the modified code, inside a single markdown code block with the correct language identifier (\`${language}\`). DO NOT add any other text.

[Target Code Block]
\`\`\`${language}
${originalContent}
\`\`\`
${contextPrompt}`;

    return { systemPrompt, userPrompt };
  }

  private parseMarkdownForCodeBlocks(
    markdownString: string
  ): {
    lang?: string;
    code: string;
  }[] {
    if (!markdownString) return [];
    const tokens = md.parse(markdownString, {});
    return tokens
      .filter((t) => t.type === "fence")
      .map((t) => ({ lang: t.info.split(" ")[0], code: t.content }));
  }

  private findCodeBlockByContent(
    markdownString: string,
    targetContent: string,
    targetLang?: string,
    targetFilepath?: string
  ): number {
    if (!markdownString) return -1;
    const tokens = md.parse(markdownString, {});
    let blockIndex = -1;
    let currentIndex = 0;
    for (const token of tokens) {
      if (token.type === "fence") {
        const lang = token.info.split(" ")[0] || undefined;
        const filepath = token.info.includes("filepath=")
          ? token.info.match(/filepath="([^"]+)"/)?.[1]
          : undefined;
        if (
          token.content.trim() === targetContent.trim() &&
          lang === targetLang &&
          filepath === targetFilepath
        ) {
          blockIndex = currentIndex;
          break;
        }
        currentIndex++;
      }
    }
    return blockIndex;
  }

  private replaceCodeBlockInMarkdown(
    originalMarkdown: string,
    blockIndex: number,
    newContent: string,
    language?: string,
    filepath?: string
  ): string {
    // Split the markdown into lines for easier manipulation
    const lines = originalMarkdown.split('\n');
    const codeBlocks = this.parseMarkdownForCodeBlocks(originalMarkdown);
    
    if (blockIndex < 0 || blockIndex >= codeBlocks.length) {
      throw new Error(`Code block index ${blockIndex} not found`);
    }
    
    // Find the actual line positions of the target code block
    let currentBlockIndex = 0;
    let startLine = -1;
    let endLine = -1;
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a code block
          if (currentBlockIndex === blockIndex) {
            startLine = i;
          }
          inCodeBlock = true;
        } else {
          // Ending a code block
          if (currentBlockIndex === blockIndex) {
            endLine = i + 1; // Include the closing ```
            break;
          }
          currentBlockIndex++;
          inCodeBlock = false;
        }
      }
    }
    
    if (startLine === -1 || endLine === -1) {
      throw new Error(`Could not find line positions for code block ${blockIndex}`);
    }
    
    // Create the new code block
    const langPrefix = language || "";
    const filepathSuffix = filepath ? ` filepath="${filepath}"` : "";
    const newCodeBlockLines = [
      `\`\`\`${langPrefix}${filepathSuffix}`,
      ...newContent.split('\n'),
      '```'
    ];
    
    // Replace the lines
    const newLines = [
      ...lines.slice(0, startLine),
      ...newCodeBlockLines,
      ...lines.slice(endLine)
    ];
    
    return newLines.join('\n');
  }

  private async handleRepairEnhanceRequest(
    interactionId: string,
    codeBlockId: string,
    language: string | undefined,
    filepath: string | undefined,
    originalContent: string,
    mode:
      | "repair"
      | "enhance"
      | "complete-message"
      | "complete-conversation"
      | "other-blocks-message"
      | "other-blocks-conversation",
    errorMessage?: string
  ): Promise<void> {
    const interactionStore = useInteractionStore.getState();
    const interaction = interactionStore.interactions.find(
      (i) => i.id === interactionId
    );
    if (!interaction || !originalContent) {
      toast.error("Required data for repair/enhance is missing.");
      return;
    }

    const modelId = usePromptStateStore.getState().modelId;
    if (!modelId) {
      toast.error(
        "No model selected. Please select a model to perform this action."
      );
      return;
    }

    const effectiveLanguage = language || "code";

    let contextPrompt = "";
    if (mode.includes("message") || mode.includes("conversation")) {
      const interactionsToScan: Interaction[] = [];
      if (mode.includes("message")) {
        interactionsToScan.push(interaction);
      } else {
        let current: Interaction | undefined = interaction;
        while (current) {
          interactionsToScan.unshift(current);
          current = interactionStore.interactions.find(
            (i) => i.id === current?.parentId
          );
        }
      }
      const contextBlocks = interactionsToScan
        .flatMap((inter) =>
          typeof inter.response === "string"
            ? this.parseMarkdownForCodeBlocks(inter.response)
            : []
        )
        .filter((block) => block.code !== originalContent);
      if (contextBlocks.length > 0) {
        contextPrompt = `\n\nFor context, here are other code blocks from the ${
          mode.includes("conversation") ? "conversation" : "message"
        }:\n\n${contextBlocks
          .map((b) => `\`\`\`${b.lang || ""}\n${b.code}\n\`\`\``)
          .join("\n\n")}`;
      }
    }

    const { systemPrompt, userPrompt } = this.getSmartPrompts(
      effectiveLanguage,
      mode,
      originalContent,
      contextPrompt,
      errorMessage
    );

    toast.loading("AI is working on the code...");

    try {
      const { providerId, modelId: specificModelId } = splitModelId(modelId);
      if (!providerId) {
        throw new Error(`Could not determine provider from model ID: ${modelId}`);
      }
      const providerConfig = useProviderStore
        .getState()
        .dbProviderConfigs.find((p) => p.id === providerId);
      const apiKey = useProviderStore.getState().getApiKeyForProvider(providerId);
      if (!providerConfig || !specificModelId) {
        throw new Error(`Invalid model ID or provider not found for ${modelId}`);
      }
      const modelInstance = instantiateModelInstance(
        providerConfig,
        specificModelId,
        apiKey === null ? undefined : apiKey
      );
      if (!modelInstance) {
        throw new Error(`Failed to instantiate model: ${modelId}`);
      }

      const result = await AIService.generateCompletion({
        model: modelInstance,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1,
        maxTokens: 4096,
      });

      if (!result) throw new Error("AI returned an empty response.");

      const aiCodeBlocks = this.parseMarkdownForCodeBlocks(result);
      if (aiCodeBlocks.length === 0)
        throw new Error("AI response did not contain a code block.");
      const enhancedContent = aiCodeBlocks[0].code;

      await this.applyCodeBlockEnhancement(
        interactionId,
        codeBlockId,
        effectiveLanguage,
        filepath,
        originalContent,
        enhancedContent,
        mode
      );

      toast.dismiss();
      toast.success(`Code ${mode} successfully as a new revision!`);
    } catch (error) {
      toast.dismiss();
      const err = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to ${mode} code: ${err}`);
      console.error(`[UniversalRepairEnhance] Error:`, error);
    }
  }

  private async applyCodeBlockEnhancement(
    interactionId: string,
    codeBlockId: string,
    language: string,
    filepath: string | undefined,
    originalContent: string,
    enhancedContent: string,
    mode: string
  ): Promise<void> {
    const interactionStore = useInteractionStore.getState();
    const originalInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId
    );
    if (!originalInteraction?.response) {
      toast.error("Original interaction not found or has no response.");
      return;
    }

    const targetBlockIndex = this.findCodeBlockByContent(
      originalInteraction.response,
      originalContent,
      language,
      filepath
    );
    if (targetBlockIndex === -1) {
      toast.error("Could not find the target code block to apply changes.");
      return;
    }

    const updatedResponse = this.replaceCodeBlockInMarkdown(
      originalInteraction.response,
      targetBlockIndex,
      enhancedContent,
      language,
      filepath
    );

    const enhancedInteractionId = nanoid();
    const enhancedInteraction: Interaction = {
      ...originalInteraction,
      id: enhancedInteractionId,
      response: updatedResponse,
      parentId: null,
      index: originalInteraction.index,
      metadata: {
        ...originalInteraction.metadata,
        editedResponse: true,
        editedFromId: originalInteraction.id,
        repairEnhancedCodeBlock: {
          codeBlockId,
          language,
          filepath,
          originalContent,
          enhancedContent,
          mode,
        },
      },
      endedAt: new Date(),
    };

    emitter.emit(interactionEvent.added, {
      interaction: enhancedInteraction,
    });

    const versionsToUpdate: Interaction[] = [];
    let current: Interaction | undefined = originalInteraction;
    while (current) {
      versionsToUpdate.push(current);
      const parentId: string | undefined = current.metadata?.editedFromId;
      current = parentId
        ? interactionStore.interactions.find((i) => i.id === parentId)
        : undefined;
    }

    versionsToUpdate.forEach((version, index) => {
      emitter.emit(interactionEvent.updated, {
        interactionId: version.id,
        updates: {
          parentId: enhancedInteractionId,
          index: index,
          metadata: {
            ...version.metadata,
            originalVersion: index === 0,
          },
        },
      });
    });
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        const {
          interactionId,
          codeBlockId,
          codeBlockContent,
          codeBlockLang,
          codeBlockFilepath,
        } = context;

        if (!interactionId || !codeBlockId || !codeBlockContent) {
          return null;
        }

        const props: RepairEnhanceCodeBlockControlProps = {
          interactionId,
          codeBlockId,
          language: codeBlockLang,
          codeContent: codeBlockContent,
          filepath: codeBlockFilepath,
        };

        return React.createElement(RepairEnhanceCodeBlockControl, props);
      },
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
  }
}
