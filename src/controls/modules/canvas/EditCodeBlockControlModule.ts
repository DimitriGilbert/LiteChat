import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type {
  LiteChatModApi,
  CanvasControlRenderContext,
} from "@/types/litechat/modding";
import { EditCodeBlockControl } from "@/controls/components/canvas/codeblock/EditCodeBlockControl";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { useInteractionStore } from "@/store/interaction.store";
import { nanoid } from "nanoid";
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";
import MarkdownIt from "markdown-it";

// Create a MarkdownIt parser instance for parsing (not a hook)
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

export class EditCodeBlockControlModule implements ControlModule {
  readonly id = "core-canvas-edit-codeblock-action";

  private eventUnsubscribers: (() => void)[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // Listen for edit code block requests
    const unsubEditCodeBlock = modApi.on(
      canvasEvent.editCodeBlockRequest,
      async (payload: { 
        interactionId: string; 
        codeBlockId: string; 
        language?: string; 
        filepath?: string; 
        originalContent: string; 
        newContent: string; 
      }) => {
        await this.handleCodeBlockEdit(
          payload.interactionId, 
          payload.codeBlockId, 
          payload.language, 
          payload.filepath, 
          payload.originalContent, 
          payload.newContent
        );
      }
    );

    this.eventUnsubscribers.push(unsubEditCodeBlock);
  }

  private parseMarkdownForCodeBlocks(markdownString: string): { type: "block"; lang?: string; code: string; filepath?: string; startPos: number; endPos: number }[] {
    if (!markdownString) return [];
    
    try {
      const tokens = md.parse(markdownString, {});
      const codeBlocks: { type: "block"; lang?: string; code: string; filepath?: string; startPos: number; endPos: number }[] = [];
      
      for (const token of tokens) {
        if ((token as any).type === "fence") {
          const fenceInfo = (token as any).info?.trim() || "";
          let lang: string | undefined;
          let filepath: string | undefined;
          
          if (fenceInfo.includes(":")) {
            const [langPart, ...pathParts] = fenceInfo.split(":");
            lang = langPart || undefined;
            filepath = pathParts.join(":") || undefined;
          } else {
            lang = fenceInfo.split(" ")[0] || undefined;
          }
          
          // Get the position information from the token
          const startPos = (token as any).map?.[0] || 0;
          const endPos = (token as any).map?.[1] || 0;
          
          codeBlocks.push({
            type: "block",
            lang: lang,
            code: (token as any).content,
            filepath: filepath,
            startPos,
            endPos
          });
        }
      }
      
      return codeBlocks;
    } catch (error) {
      console.error("Markdown parsing error:", error);
      return [];
    }
  }

  // Store mapping of blockId to content for lookup during editing
  private blockIdToContentMap = new Map<string, { content: string; lang?: string; filepath?: string }>();

  private findCodeBlockByContent(markdownString: string, targetContent: string, targetLang?: string, targetFilepath?: string): number {
    const codeBlocks = this.parseMarkdownForCodeBlocks(markdownString);
    
    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      if (block.code === targetContent && 
          block.lang === targetLang && 
          block.filepath === targetFilepath) {
        return i;
      }
    }
    
    // Fallback: try to find by content only
    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      if (block.code === targetContent) {
        return i;
      }
    }
    
    return -1;
  }

  private replaceCodeBlockInMarkdown(originalMarkdown: string, blockIndex: number, newContent: string, language?: string, filepath?: string): string {
    // Split the markdown into lines for easier manipulation
    const lines = originalMarkdown.split('\n');
    const codeBlocks = this.parseMarkdownForCodeBlocks(originalMarkdown);
    
    if (blockIndex < 0 || blockIndex >= codeBlocks.length) {
      throw new Error(`Code block index ${blockIndex} not found`);
    }
    
    const targetBlock = codeBlocks[blockIndex];
    const startLine = targetBlock.startPos;
    const endLine = targetBlock.endPos;
    
    // Create the new code block
    const langPrefix = language ? language : "";
    const filepathSuffix = filepath ? `:${filepath}` : "";
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

  private async handleCodeBlockEdit(
    interactionId: string, 
    codeBlockId: string, 
    language?: string, 
    filepath?: string, 
    originalContent?: string, 
    newContent?: string
  ): Promise<void> {
    try {
      const interactionStore = useInteractionStore.getState();
      const originalInteraction = interactionStore.interactions.find(i => i.id === interactionId);
      
      if (!originalInteraction) {
        throw new Error("Original interaction not found");
      }

      if (originalInteraction.status !== "COMPLETED") {
        throw new Error("Can only edit completed interactions");
      }

      if (!originalInteraction.response || typeof originalInteraction.response !== "string") {
        throw new Error("Invalid response content");
      }

      // Find the code block by matching the original content, language, and filepath
      // This is more reliable than trying to parse block indices from IDs
      const targetBlockIndex = this.findCodeBlockByContent(
        originalInteraction.response,
        originalContent || "",
        language,
        filepath
      );
      
      if (targetBlockIndex === -1) {
        throw new Error("Code block not found in response");
      }
      
      // Use the robust replacement method
      const updatedResponse = this.replaceCodeBlockInMarkdown(
        originalInteraction.response,
        targetBlockIndex,
        newContent || "",
        language,
        filepath
      );

      // Create the edited interaction (this becomes the new main interaction)
      const editedInteractionId = nanoid();
      
      // The edited interaction inherits the position of the original on the main spine
      const editedInteraction: Interaction = {
        ...originalInteraction,
        id: editedInteractionId,
        response: updatedResponse,
        parentId: null, // This stays on the main spine
        index: originalInteraction.index, // Inherits the conversation position
        metadata: {
          ...originalInteraction.metadata,
          editedResponse: true,
          editedFromId: originalInteraction.id, // Track what it was edited from
          editedCodeBlock: {
            codeBlockId,
            language,
            filepath,
            originalContent,
            newContent,
          },
        },
        endedAt: new Date(), // Update the timestamp
      };

      // Add the edited interaction to the state first
      interactionStore._addInteractionToState(editedInteraction);

      // Now we need to create the version chain just like regeneration does
      // Find all existing children of the original (if any)
      const existingChildren = interactionStore.interactions.filter(
        i => i.parentId === originalInteraction.id
      );

      // Create the version update chain - original becomes first child, existing children shift down
      const versionsToUpdate: Interaction[] = [];
      let currentInteractionInChain: Interaction | undefined = originalInteraction;

      // Build the chain of versions that need to be updated (like regeneration does)
      while (currentInteractionInChain) {
        versionsToUpdate.push(currentInteractionInChain);
        const editedFromId: string | undefined = currentInteractionInChain.metadata?.editedFromId;
        if (editedFromId) {
          currentInteractionInChain = interactionStore.interactions.find(i => i.id === editedFromId);
        } else {
          currentInteractionInChain = undefined;
        }
      }

      // Sort versions chronologically (oldest to newest)
      const chronologicalVersionsToUpdate = versionsToUpdate.sort((a, b) => {
        const timeA = a.startedAt?.getTime() ?? 0;
        const timeB = b.startedAt?.getTime() ?? 0;
        return timeA - timeB;
      });

      // Update each version to be a child of the new edited interaction
      const updatePromises = chronologicalVersionsToUpdate.map(async (versionToUpdate, index) => {
        const updatesForOldVersion: Partial<Omit<Interaction, "id">> = {
          parentId: editedInteractionId,
          index: index, // 0, 1, 2, etc.
          metadata: {
            ...versionToUpdate.metadata,
            originalVersion: index === 0, // First one is the "original version"
          }
        };

        interactionStore._updateInteractionInState(versionToUpdate.id, updatesForOldVersion);
        return PersistenceService.saveInteraction({
          ...versionToUpdate,
          ...updatesForOldVersion,
        } as Interaction);
      });

      // Also update any existing children to be children of the edited interaction
      const childUpdatePromises = existingChildren.map(async (child) => {
        const childUpdates: Partial<Omit<Interaction, "id">> = {
          parentId: editedInteractionId,
          index: chronologicalVersionsToUpdate.length + child.index, // Shift after all versions
        };
        
        interactionStore._updateInteractionInState(child.id, childUpdates);
        return PersistenceService.saveInteraction({
          ...child,
          ...childUpdates,
        } as Interaction);
      });

      // Persist all changes
      await Promise.all([
        PersistenceService.saveInteraction(editedInteraction),
        ...updatePromises,
        ...childUpdatePromises
      ]);

    } catch (error) {
      console.error(`[EditCodeBlockControlModule] Failed to edit code block:`, error);
      throw error;
    }
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions", // Appears in the code block header
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.codeBlockContent || !context.interactionId) {
          return null;
        }

        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        const currentInteraction = interactionStoreState.interactions.find(
          i => i.id === context.interactionId
        );
        
        // Only show edit button for completed assistant responses with code blocks
        const canEdit = 
          currentInteraction &&
          currentInteraction.status === "COMPLETED" &&
          currentInteraction.response &&
          typeof currentInteraction.response === "string" &&
          globalStreamingStatus !== "streaming" &&
          (currentInteraction.type === "message.user_assistant" || 
           currentInteraction.type === "message.assistant_regen") &&
          context.codeBlockContent &&
          context.codeBlockContent.trim().length > 0;

        if (!canEdit) {
          return null;
        }

        // Use the unique blockId from UniversalBlockRenderer if available
        // This ensures we always edit the correct block, even with identical content
        const codeBlockId = context.blockId || `fallback-${Date.now()}`;

        return React.createElement(EditCodeBlockControl, {
          interactionId: context.interactionId,
          codeBlockId: codeBlockId,
          language: context.codeBlockLang,
          filepath: context.codeBlockFilepath,
          originalContent: context.codeBlockContent || "",
          editedContent: context.codeBlockEditedContent || context.codeBlockContent || "",
          disabled: !canEdit,
          onEditModeChange: context.onEditModeChange,
        });
      },
    });
  }

  async cleanup(): Promise<void> {
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
  }

  async destroy(): Promise<void> {
    await this.cleanup();
  }
} 