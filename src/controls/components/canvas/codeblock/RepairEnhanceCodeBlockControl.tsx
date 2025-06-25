import React, { useCallback, useState } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { WrenchIcon, MessageSquareIcon, HistoryIcon, CodeIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useInteractionStore } from "@/store/interaction.store";
import { InteractionService } from "@/services/interaction.service";
import { usePromptStateStore } from "@/store/prompt.store";
import { nanoid } from "nanoid";
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";

interface RepairEnhanceCodeBlockControlProps {
  interactionId?: string;
  codeBlockId?: string;
  language?: string;
  codeContent: string;
  filepath?: string;
  disabled?: boolean;
  errorMessage?: string;
}

export const RepairEnhanceCodeBlockControl: React.FC<RepairEnhanceCodeBlockControlProps> = ({
  interactionId,
  codeBlockId,
  language,
  codeContent,
  filepath,
  disabled,
  errorMessage,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRepairEnhance = useCallback(
    async (mode: "repair" | "enhance" | "complete-message" | "complete-conversation" | "other-blocks-message" | "other-blocks-conversation") => {
      if (disabled || !codeContent || !interactionId) return;

      setIsProcessing(true);
      try {
        const interactionStore = useInteractionStore.getState();
        const promptState = usePromptStateStore.getState();
        
        const currentInteraction = interactionStore.interactions.find(i => i.id === interactionId);
        if (!currentInteraction) {
          toast.error("Interaction not found");
          return;
        }

        let promptContent = "";
        let systemPrompt = "";

        // Build the prompt based on mode
        switch (mode) {
          case "repair":
            systemPrompt = "You are a code repair assistant. Fix any issues in the provided code block and explain what was wrong.";
            promptContent = `Please repair this ${language || "code"} block${filepath ? ` from ${filepath}` : ""}:

\`\`\`${language || ""}
${codeContent}
\`\`\``;
            
            if (errorMessage) {
              promptContent += `\n\nError message:\n${errorMessage}`;
            }
            break;

          case "enhance":
            systemPrompt = "You are a code enhancement assistant. Improve the provided code by adding features, optimizing performance, or following best practices.";
            promptContent = `Please enhance this ${language || "code"} block${filepath ? ` from ${filepath}` : ""} with improvements, optimizations, or additional features:

\`\`\`${language || ""}
${codeContent}
\`\`\``;
            break;

          case "complete-message":
            systemPrompt = "You are a helpful coding assistant. Address the user's request about this code block in the context of their complete message.";
            promptContent = `Please help with this ${language || "code"} block${filepath ? ` from ${filepath}` : ""}:

\`\`\`${language || ""}
${codeContent}
\`\`\`

Here's the complete message for context:
${currentInteraction.prompt?.content || "No additional context available."}`;
            break;

          case "complete-conversation":
            systemPrompt = "You are a helpful coding assistant. Address the user's request about this code block considering the full conversation history.";
            
            // Get conversation history
            const conversationInteractions = interactionStore.interactions
              .filter(i => 
                i.conversationId === currentInteraction.conversationId && 
                i.status === "COMPLETED" &&
                (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
              )
              .sort((a, b) => a.index - b.index);

            const conversationHistory = conversationInteractions
              .map(interaction => {
                const userContent = interaction.prompt?.content || "";
                const assistantContent = interaction.response || "";
                return `**User:** ${userContent}\n\n**Assistant:** ${assistantContent}`;
              })
              .join("\n\n---\n\n");

            promptContent = `Please help with this ${language || "code"} block${filepath ? ` from ${filepath}` : ""}:

\`\`\`${language || ""}
${codeContent}
\`\`\`

Here's our complete conversation for context:
${conversationHistory}`;
            break;

          case "other-blocks-message":
            systemPrompt = "You are a helpful coding assistant. Address the user's request about this code block considering other code blocks in the same message.";
            
            // Extract other code blocks from the current message
            const messageContent = currentInteraction.response || "";
            const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
            const otherBlocks: Array<{lang: string; code: string}> = [];
            let match;
            
            while ((match = codeBlockRegex.exec(messageContent)) !== null) {
              const blockCode = match[2];
              const blockLang = match[1] || "";
              // Skip the current block
              if (blockCode !== codeContent) {
                otherBlocks.push({ lang: blockLang, code: blockCode });
              }
            }

            promptContent = `Please help with this ${language || "code"} block${filepath ? ` from ${filepath}` : ""}:

\`\`\`${language || ""}
${codeContent}
\`\`\``;

            if (otherBlocks.length > 0) {
              promptContent += `\n\nOther code blocks in this message for context:`;
              otherBlocks.forEach((block, index) => {
                promptContent += `\n\nBlock ${index + 1} (${block.lang}):
\`\`\`${block.lang}
${block.code}
\`\`\``;
              });
            }
            break;

          case "other-blocks-conversation":
            systemPrompt = "You are a helpful coding assistant. Address the user's request about this code block considering all code blocks in the conversation.";
            
            // Extract all code blocks from conversation
            const allConversationInteractions = interactionStore.interactions
              .filter(i => 
                i.conversationId === currentInteraction.conversationId && 
                i.status === "COMPLETED" &&
                i.response
              )
              .sort((a, b) => a.index - b.index);

            const allCodeBlocks: Array<{lang: string; code: string; from: string}> = [];
            
            allConversationInteractions.forEach((interaction, idx) => {
              const content = interaction.response || "";
              const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
              let match;
              
              while ((match = codeBlockRegex.exec(content)) !== null) {
                const blockCode = match[2];
                const blockLang = match[1] || "";
                // Skip the current block
                if (blockCode !== codeContent) {
                  allCodeBlocks.push({ 
                    lang: blockLang, 
                    code: blockCode, 
                    from: `Message ${idx + 1}` 
                  });
                }
              }
            });

            promptContent = `Please help with this ${language || "code"} block${filepath ? ` from ${filepath}` : ""}:

\`\`\`${language || ""}
${codeContent}
\`\`\``;

            if (allCodeBlocks.length > 0) {
              promptContent += `\n\nAll other code blocks in this conversation for context:`;
              allCodeBlocks.forEach((block, index) => {
                promptContent += `\n\n${block.from} - Block ${index + 1} (${block.lang}):
\`\`\`${block.lang}
${block.code}
\`\`\``;
              });
            }
            break;
        }

        // Create prompt object
        const promptObject: PromptObject = {
          system: systemPrompt,
          messages: [{ role: "user", content: promptContent }],
          parameters: {
            temperature: promptState.temperature || 0.7,
            max_tokens: promptState.maxTokens || 2000,
          },
                     metadata: {
             modelId: promptState.modelId || undefined,
             isCodeBlockRepairEnhance: true,
             originalCodeBlockId: codeBlockId,
             originalInteractionId: interactionId,
             repairEnhanceMode: mode,
           },
        };

        const turnData: PromptTurnObject = {
          id: nanoid(),
          content: promptContent,
          parameters: promptObject.parameters,
          metadata: {
            ...promptObject.metadata,
            originalCodeContent: codeContent,
            originalLanguage: language,
            originalFilepath: filepath,
          },
        };

        // Start the interaction
        await InteractionService.startInteraction(
          promptObject,
          currentInteraction.conversationId,
          turnData
        );

        toast.success(`${mode === "repair" ? "Repair" : "Enhancement"} request sent`);
      } catch (error) {
        console.error("RepairEnhanceCodeBlockControl: Error starting interaction", error);
        toast.error(`Failed to ${mode === "repair" ? "repair" : "enhance"} code block: ${String(error)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [disabled, codeContent, interactionId, codeBlockId, language, filepath, errorMessage]
  );

  // Only show for completed interactions with code content
  if (!codeContent || !codeContent.trim() || disabled) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionTooltipButton
          tooltipText="Repair or enhance this code block"
          aria-label="Repair or enhance code block"
          disabled={disabled || isProcessing}
          icon={<WrenchIcon />}
          iconClassName="h-3.5 w-3.5"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => handleRepairEnhance("repair")}>
          <WrenchIcon className="mr-2 h-4 w-4" />
          Repair Code Block
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRepairEnhance("enhance")}>
          <WrenchIcon className="mr-2 h-4 w-4" />
          Enhance Code Block
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleRepairEnhance("complete-message")}>
          <MessageSquareIcon className="mr-2 h-4 w-4" />
          Include Complete Message
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRepairEnhance("complete-conversation")}>
          <HistoryIcon className="mr-2 h-4 w-4" />
          Include Complete Conversation
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleRepairEnhance("other-blocks-message")}>
          <CodeIcon className="mr-2 h-4 w-4" />
          Include Other Code Blocks (Message)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRepairEnhance("other-blocks-conversation")}>
          <CodeIcon className="mr-2 h-4 w-4" />
          Include Other Code Blocks (Conversation)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}; 