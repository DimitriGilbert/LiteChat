import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { EditResponseControl } from "@/controls/components/canvas/EditResponseControl";
import { useInteractionStore } from "@/store/interaction.store";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { PersistenceService } from "@/services/persistence.service";
import type { Interaction } from "@/types/litechat/interaction";
import { nanoid } from "nanoid";

export class EditResponseControlModule implements ControlModule {
  readonly id = "core-canvas-edit-response-action";

  private eventUnsubscribers: (() => void)[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // Listen for edit response requests
    const unsubEditResponse = modApi.on(
      canvasEvent.editResponseRequest,
      async (payload: { interactionId: string; newContent: string }) => {
        await this.handleResponseEdit(payload.interactionId, payload.newContent);
      }
    );

    this.eventUnsubscribers.push(unsubEditResponse);
  }

  private async handleResponseEdit(interactionId: string, newContent: string): Promise<void> {
    try {
      const interactionStore = useInteractionStore.getState();
      const originalInteraction = interactionStore.interactions.find(i => i.id === interactionId);
      
      if (!originalInteraction) {
        throw new Error("Original interaction not found");
      }

      if (originalInteraction.status !== "COMPLETED") {
        throw new Error("Can only edit completed interactions");
      }

      // Create the edited interaction (this becomes the new main interaction)
      const editedInteractionId = nanoid();
      
      // The edited interaction inherits the position of the original on the main spine
      const editedInteraction: Interaction = {
        ...originalInteraction,
        id: editedInteractionId,
        response: newContent,
        parentId: null, // This stays on the main spine
        index: originalInteraction.index, // Inherits the conversation position
        metadata: {
          ...originalInteraction.metadata,
          editedResponse: true,
          editedFromId: originalInteraction.id, // Track what it was edited from
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

        console.log(`[EditResponseControlModule] Updating version ${versionToUpdate.id} to be child of ${editedInteractionId} with childIndex ${index}`);

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

      console.log(`[EditResponseControlModule] Response edited successfully. Original: ${interactionId}, Edited: ${editedInteractionId}`);

    } catch (error) {
      console.error(`[EditResponseControlModule] Failed to edit response:`, error);
      throw error;
    }
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "actions", // Appears in the footer actions
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          return null;
        }

        const currentInteraction = context.interaction;
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        
        // Only show edit button for completed assistant responses
        const canEdit = 
          currentInteraction.status === "COMPLETED" &&
          currentInteraction.response &&
          typeof currentInteraction.response === "string" &&
          globalStreamingStatus !== "streaming" &&
          (currentInteraction.type === "message.user_assistant" || 
           currentInteraction.type === "message.assistant_regen");

        if (!canEdit) {
          return null;
        }

        return React.createElement(EditResponseControl, {
          interactionId: currentInteraction.id,
          response: currentInteraction.response as string,
          disabled: !canEdit,
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