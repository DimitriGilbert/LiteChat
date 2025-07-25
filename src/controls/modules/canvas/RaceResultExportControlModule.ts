// src/controls/modules/canvas/RaceResultExportControlModule.ts
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { RaceResultExportControl } from "@/controls/components/canvas/RaceResultExportControl";
import { useInteractionStore } from "@/store/interaction.store";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { RaceResultExportService } from "@/services/race-result-export.service";
import { toast } from "sonner";
import type { Interaction } from "@/types/litechat/interaction";

export class RaceResultExportControlModule implements ControlModule {
  readonly id = "core-canvas-race-result-export";

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // Subscribe to race result export requests
    const unsubscribe = modApi.on(canvasEvent.raceResultExportRequest, async (payload) => {
      await this.handleRaceResultExport(payload.interactionId, payload.conversationId);
    });

    // Store unsubscribe callback for cleanup
    this.unsubscribeRaceExport = unsubscribe;
  }

  private unsubscribeRaceExport?: () => void;

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
        
        // Only show for race interactions
        if (!this.isRaceInteraction(currentInteraction)) {
          return null;
        }

        // Only show for completed race interactions
        if (currentInteraction.status !== "COMPLETED") {
          return null;
        }

        // Find the main race interaction ID (either this one or its parent)
        const mainRaceInteractionId = this.getMainRaceInteractionId(currentInteraction);

        return React.createElement(RaceResultExportControl, {
          interactionId: mainRaceInteractionId,
          conversationId: currentInteraction.conversationId,
        });
      },
    });
  }

  destroy(): void {
    if (this.unsubscribeRaceExport) {
      this.unsubscribeRaceExport();
      this.unsubscribeRaceExport = undefined;
    }
  }

  /**
   * Checks if an interaction is part of a race
   */
  private isRaceInteraction(interaction: Interaction): boolean {
    return (
      interaction.metadata?.raceTab === true ||
      interaction.metadata?.isRaceCombining === true ||
      interaction.metadata?.raceMainInteractionId !== undefined
    );
  }

  /**
   * Checks if an interaction is the main race interaction (not a child)
   */
  private isMainRaceInteraction(interaction: Interaction): boolean {
    // Main race interaction has either:
    // 1. isRaceCombining: true (combine mode)
    // 2. raceMainInteractionId === interaction.id (non-combine mode, self-reference)
    // 3. parentId === null and has race metadata
    return (
      interaction.metadata?.isRaceCombining === true ||
      interaction.metadata?.raceMainInteractionId === interaction.id ||
      (interaction.parentId === null && this.isRaceInteraction(interaction))
    );
  }

  /**
   * Gets the main race interaction ID for any race interaction (including children)
   */
  private getMainRaceInteractionId(interaction: Interaction): string {
    // If this is the main race interaction, return its own ID
    if (this.isMainRaceInteraction(interaction)) {
      return interaction.id;
    }

    // If this is a child, return the parent ID or raceMainInteractionId
    if (interaction.parentId) {
      return interaction.parentId;
    }

    // If raceMainInteractionId is set and different from current ID, use that
    if (interaction.metadata?.raceMainInteractionId && 
        interaction.metadata.raceMainInteractionId !== interaction.id) {
      return interaction.metadata.raceMainInteractionId;
    }

    // Fallback to current interaction ID
    return interaction.id;
  }

  /**
   * Gets all race-related interactions for a main race interaction
   */
  private getRaceInteractions(mainInteractionId: string): Interaction[] {
    const interactionStore = useInteractionStore.getState();
    const allInteractions = interactionStore.interactions;

    // Find the main interaction
    const mainInteraction = allInteractions.find(i => i.id === mainInteractionId);
    if (!mainInteraction) {
      return [];
    }

    const raceInteractions: Interaction[] = [];

    if (mainInteraction.metadata?.isRaceCombining) {
      // Combine mode: Main interaction + all children
      raceInteractions.push(mainInteraction);
      
      // Find all child interactions
      const children = allInteractions.filter(i => i.parentId === mainInteractionId);
      raceInteractions.push(...children);
    } else {
      // Non-combine mode: Main interaction (original model) + race children
      raceInteractions.push(mainInteraction);
      
      // Find all child interactions
      const children = allInteractions.filter(i => i.parentId === mainInteractionId);
      raceInteractions.push(...children);
    }

    return raceInteractions;
  }

  /**
   * Handles the race result export request
   */
  private async handleRaceResultExport(interactionId: string, _conversationId?: string): Promise<void> {
    try {
      toast.info("Preparing race results for export...");

      // Get all race interactions
      const raceInteractions = this.getRaceInteractions(interactionId);
      
      if (raceInteractions.length === 0) {
        toast.error("No race interactions found to export");
        return;
      }

      // Filter out the main combining interaction if it exists (we only want the participant responses)
      const participantInteractions = raceInteractions.filter(interaction => {
        // Exclude main combining interactions that don't have actual AI responses
        return !(interaction.metadata?.isRaceCombining && !interaction.response);
      });

      if (participantInteractions.length === 0) {
        toast.error("No participant interactions found to export");
        return;
      }

      // Extract the original prompt from the first interaction
      const firstInteraction = raceInteractions[0];
      const promptText = firstInteraction.prompt?.content || "Race interaction results";

      // Generate the ZIP file
      const zipBlob = await RaceResultExportService.exportRaceResults(
        participantInteractions,
        promptText
      );

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `litechat-race-results-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Race results exported! Downloaded ZIP with ${participantInteractions.length} model results.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to export race results: ${errorMessage}`);
      console.error('Race result export error:', error);
    }
  }
}