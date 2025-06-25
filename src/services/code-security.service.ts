import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { AIService } from "@/services/ai.service";
import { PersistenceService } from "@/services/persistence.service";
import { splitModelId, instantiateModelInstance } from "@/lib/litechat/provider-helpers";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { Interaction } from "@/types/litechat/interaction";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { interpolateColor } from "@/lib/utils";

export interface CodeSecurityResult {
  score: number;
  isValid: boolean;
  requiresConfirmation: boolean;
  clicksRequired: number;
  riskLevel: 'safe' | 'moderate' | 'high' | 'extreme';
  color: string;
}

export class CodeSecurityService {
  public static async validateCodeSecurity(code: string, language: 'javascript' | 'python'): Promise<CodeSecurityResult> {
    const settings = useSettingsStore.getState();
    
    if (!settings.runnableBlocksSecurityCheckEnabled) {
      // Security check disabled, return safe by default
      return {
        score: 0,
        isValid: true,
        requiresConfirmation: false,
        clicksRequired: 1,
        riskLevel: 'safe',
        color: '#22c55e' // green
      };
    }

    const modelId = settings.runnableBlocksSecurityModelId;
    if (!modelId) {
      console.warn("No model selected for code security validation");
      toast.error("No model selected for security validation in settings.");
      return {
        score: 50,
        isValid: false,
        requiresConfirmation: true,
        clicksRequired: 2,
        riskLevel: 'moderate',
        color: '#eab308' // yellow
      };
    }

    const conversationId = useInteractionStore.getState().currentConversationId || "unassigned";
    const interactionId = nanoid();
    let interaction: Interaction | null = null;

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
        apiKey === null ? undefined : apiKey,
      );

      if (!modelInstance) {
        throw new Error(`Failed to instantiate model: ${modelId}`);
      }

      const systemPrompt = "You are a cybersecurity expert analyzing code for potential security risks. You only respond with a single number from 0 to 100.";
      const promptTemplate = settings.runnableBlocksSecurityPrompt ||
        "Analyze the following code for potential security risks or malicious behavior. Respond with ONLY a number from 0 to 100 where:\n- 0-30: Safe code (reading data, basic calculations, simple DOM manipulation)\n- 31-60: Moderate risk (file operations, network requests, eval usage)\n- 61-90: High risk (system commands, dangerous APIs, potential privacy violations)\n- 91-100: Extremely dangerous (malware, destructive operations, clear security threats)\n\nCode to analyze:\n{{code}}\n\nReturn only the numeric risk score (0-100).";

      const filledPrompt = promptTemplate.replace("{{code}}", code);

      const turnData: PromptTurnObject = {
        id: nanoid(),
        content: `[Security check for ${language} code: ${code.substring(0, 50)}...]`,
        parameters: { temperature: 0.1, maxTokens: 10 },
        metadata: {
          modelId: modelId,
          isSecurityCheck: true,
          codeLanguage: language,
          systemPrompt: systemPrompt,
        },
      };

      interaction = {
        id: interactionId,
        conversationId: conversationId,
        startedAt: new Date(),
        endedAt: null,
        type: "code.security_check",
        status: "STREAMING",
        prompt: turnData,
        response: null,
        index: -1,
        parentId: null,
        metadata: { ...turnData.metadata },
      };

      await PersistenceService.saveInteraction(interaction);

      const result = await AIService.generateCompletion({
        model: modelInstance,
        system: systemPrompt,
        messages: [{ role: "user", content: filledPrompt }],
        temperature: 0.1,
        maxTokens: 10,
      });

      if (!result) {
        throw new Error("AI returned an empty response.");
      }

      let score = 0;
      try {
        // Extract numeric score from response
        const cleaned = result.trim();
        // Match numbers 0-100 more precisely
        const numericMatch = cleaned.match(/\b(100|[0-9]{1,2})\b/);
        if (!numericMatch) {
          throw new Error("No numeric score found in AI response.");
        }
        const parsedScore = parseInt(numericMatch[1], 10);
        // The regex already ensures 0-100, but double-check for safety
        if (isNaN(parsedScore)) {
          throw new Error(`Failed to parse score: ${numericMatch[1]}`);
        }
        score = parsedScore;
      } catch (err) {
        console.error("Failed to parse AI response for security score:", err, "Raw response:", result);
        throw new Error(`AI response was not a valid score. ${err instanceof Error ? err.message : ""}`);
      }
      
      const finalInteraction: Interaction = {
        ...interaction,
        status: "COMPLETED",
        endedAt: new Date(),
        response: result,
        metadata: {
          ...interaction.metadata,
          securityScore: score,
        },
      };
      await PersistenceService.saveInteraction(finalInteraction);

      // Calculate risk level and UI properties
      const riskLevel = score <= 30 ? 'safe' : score <= 60 ? 'moderate' : score <= 90 ? 'high' : 'extreme';
      const clicksRequired = score <= 30 ? 1 : score <= 60 ? 2 : score <= 90 ? 3 : 3;
      const requiresConfirmation = score > 30;
      const color = interpolateColor(score);

      return {
        score,
        isValid: true,
        requiresConfirmation,
        clicksRequired,
        riskLevel,
        color,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Code security validation error:", error);

      if (interaction) {
        const finalInteraction: Interaction = {
          ...interaction,
          status: "ERROR",
          endedAt: new Date(),
          response: null,
          metadata: {
            ...interaction.metadata,
            error: errorMessage,
          },
        };
        await PersistenceService.saveInteraction(finalInteraction);
      }

      // Return moderate risk on error
      return {
        score: 50,
        isValid: false,
        requiresConfirmation: true,
        clicksRequired: 2,
        riskLevel: 'moderate',
        color: '#eab308', // yellow
      };
    }
  }
} 