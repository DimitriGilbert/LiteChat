import React from "react";
import { PromptForm } from "./prompt-form";
import { cn } from "@/lib/utils";
import type {
  AiModelConfig,
  AiProviderConfig,
  DbConversation,
  CustomPromptAction,
  CustomSettingTab,
  ReadonlyChatContextSnapshot,
} from "@/lib/types";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useShallow } from "zustand/react/shallow";

interface PromptWrapperProps {
  className?: string;
  onFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  activeConversationData: DbConversation | null;
  customSettingsTabs: CustomSettingTab[];
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  className,
  onFormSubmit,
  stopStreaming,
  customPromptActions,
  getContextSnapshot,
  selectedModel,
  // customSettingsTabs,
}) => {
  const { error } = useCoreChatStore(
    useShallow((state) => ({
      error: state.error,
      isStreaming: state.isStreaming,
    })),
  );

  return (
    <div className={cn("flex-shrink-0 border-t", className)}>
      {error && (
        <div className="bg-destructive text-destructive-foreground p-2 text-sm text-center">
          Error: {error}
        </div>
      )}
      {/* PromptForm fetches most state itself */}
      <PromptForm
        onFormSubmit={onFormSubmit}
        customPromptActions={customPromptActions}
        getContextSnapshot={getContextSnapshot}
        selectedModel={selectedModel}
        stopStreaming={stopStreaming}
      />
    </div>
  );
};
