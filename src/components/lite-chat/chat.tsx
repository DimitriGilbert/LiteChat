import React from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import type { AiProviderConfig } from "@/lib/types";
import { cn } from "@/lib/utils"; // Assuming shadcn/ui utils

// Export sub-components for composability
export { ChatContent } from "./chat-content";
export { ChatHistory } from "./chat-history";
export { ChatSide } from "./chat-side";
export { ChatWrapper } from "./chat-wrapper";
export { MessageActions } from "./message-actions";
export { MemoizedMessageBubble as MessageBubble } from "./message-bubble"; // Export memoized version
export { ModelSelector } from "./model-selector";
export { PromptActions } from "./prompt-actions";
export { PromptFiles } from "./prompt-files";
export { PromptForm } from "./prompt-form";
export { PromptInput } from "./prompt-input";
export { PromptSettings } from "./prompt-settings";
export { PromptWrapper } from "./prompt-wrapper";
export { ProviderSelector } from "./provider-selector";
export { SettingsModal } from "./settings-modal";
export { useChatContext, ChatProvider } from "@/context/chat-context"; // Export context hook and provider
export type { AiProviderConfig, AiModelConfig, Message } from "@/lib/types"; // Export types

// --- Main Chat Component Props ---
interface LiteChatProps {
  /** Configuration for AI providers and models */
  providers: AiProviderConfig[];
  /** Optional: ID of the initially selected provider */
  initialProviderId?: string | null;
  /** Optional: ID of the initially selected model */
  initialModelId?: string | null;
  /** Optional: ID of the initially selected conversation */
  initialConversationId?: string | null;
  /** Optional: Throttle rate for streaming UI updates (ms). Default: ~24fps */
  streamingThrottleRate?: number;
  /** Optional: Class name for the main chat container */
  className?: string;
  /** Optional: Allow replacing the Side component */
  SideComponent?: React.ComponentType<{ className?: string }>;
  /** Optional: Allow replacing the Wrapper component */
  WrapperComponent?: React.ComponentType<{ className?: string }>;
}

/**
 * LiteChat: A client-side AI chat component using Vercel AI SDK and IndexedDB.
 */
export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  initialProviderId,
  initialModelId,
  initialConversationId,
  streamingThrottleRate,
  className,
  SideComponent = ChatSide, // Default component
  WrapperComponent = ChatWrapper, // Default component
}) => {
  return (
    <ChatProvider
      providers={providers}
      initialProviderId={initialProviderId}
      initialModelId={initialModelId}
      initialConversationId={initialConversationId}
      streamingThrottleRate={streamingThrottleRate}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden border rounded-md", // Base styling
          className,
        )}
      >
        <SideComponent />
        <WrapperComponent />
      </div>
    </ChatProvider>
  );
};
