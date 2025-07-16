import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { InteractionService } from "@/services/interaction.service";
import { useInteractionStore } from "@/store/interaction.store";
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { ModelMessage, TextPart } from "ai";
import { nanoid } from "nanoid";
import { toast } from "sonner";

export class PromptEnhancementService {
  static initialize(): void {
    // Listen for prompt enhancement requests
    emitter.on(promptEvent.enhancePromptRequest, async (payload) => {
      await this.handlePromptEnhancement(payload);
    });
  }

  private static async handlePromptEnhancement(payload: {
    prompt: string;
    modelId: string;
    systemPrompt?: string;
  }): Promise<void> {
    try {
      const { prompt, modelId, systemPrompt } = payload;
      
      // Get current conversation context
      const interactionStore = useInteractionStore.getState();
      
      const currentConversationId = interactionStore.currentConversationId;
      if (!currentConversationId) {
        toast.error("No active conversation for prompt enhancement");
        return;
      }

      // Create a new interaction for the enhancement
      const interactionId = nanoid();
      
      // Emit enhancement started event
      emitter.emit(promptEvent.enhancementStarted, {
        interactionId,
        originalPrompt: prompt,
      });

      // Build conversation history for context
      const conversationInteractions = interactionStore.interactions
        .filter(
          (i) =>
            i.conversationId === currentConversationId &&
            i.status === "COMPLETED" &&
            i.type === "message.user_assistant" &&
            i.parentId === null
        )
        .sort((a, b) => a.index - b.index);

      const historyMessages: ModelMessage[] = buildHistoryMessages(conversationInteractions);

      // Create the enhancement system prompt
      const defaultEnhancementPrompt = `You are an expert prompt engineer. Your task is to improve and enhance the given user prompt to make it more effective, specific, and likely to produce better results from AI models.

Please analyze the user's prompt and enhance it by:
1. Making it more specific and detailed
2. Adding relevant context or constraints if helpful
3. Improving clarity and structure
4. Suggesting better formatting if needed
5. Maintaining the original intent and requirements

Return ONLY the enhanced prompt without any explanations, comments, or additional text.`;

      const finalSystemPrompt = systemPrompt || defaultEnhancementPrompt;

      // Prepare the enhancement request message
      const enhancementMessage: ModelMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: `Please enhance this prompt:\n\n${prompt}`,
          } as TextPart,
        ],
      };

      // Create prompt object for the enhancement interaction
      const promptObject: PromptObject = {
        system: finalSystemPrompt,
        messages: [...historyMessages, enhancementMessage],
        parameters: {
          temperature: 0.3, // Lower temperature for more consistent enhancements
          max_tokens: 1000,
        },
        metadata: {
          modelId,
          isPromptEnhancement: true,
        },
      };

      // Create turn data for the enhancement request
      const turnData: PromptTurnObject = {
        id: interactionId,
        content: `Enhance prompt: ${prompt}`,
        parameters: {
          temperature: 0.3,
          max_tokens: 1000,
        },
        metadata: {
          modelId,
          isPromptEnhancement: true,
          originalPrompt: prompt,
        },
      };

      // Start the enhancement interaction
      const interaction = await InteractionService.startInteraction(
        promptObject,
        currentConversationId,
        turnData,
        "prompt.enhance"
      );

      if (!interaction) {
        throw new Error("Failed to create prompt enhancement interaction");
      }

      toast.info("Enhancing your prompt...");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[PromptEnhancementService] Error during prompt enhancement:", error);
      
      emitter.emit(promptEvent.enhancementFailed, {
        interactionId: "unknown",
        error: errorMessage,
      });
      
      toast.error(`Prompt enhancement failed: ${errorMessage}`);
    }
  }

  static async handleEnhancementCompletion(
    interactionId: string,
    enhancedPrompt: string
  ): Promise<void> {
    try {
      // Emit enhancement completed event
      emitter.emit(promptEvent.enhancementCompleted, {
        interactionId,
        enhancedPrompt,
      });

      toast.success("Prompt enhanced successfully!");
    } catch (error) {
      console.error("[PromptEnhancementService] Error handling enhancement completion:", error);
    }
  }
} 