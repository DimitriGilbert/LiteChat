// src/hooks/use-chat-context.ts
import { useContext, createContext } from "react";
import type { ChatContextProps } from "@/lib/types"; // Ensure this type is updated if needed

// Create the context object. We need to provide an initial value,
// but it will be immediately replaced by the ChatProvider.
// Using 'undefined' and checking in the hook is standard practice.
export const ChatContext = createContext<ChatContextProps | undefined>(
  undefined,
);

export const useChatContext = (): ChatContextProps => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    // This error means you tried to use the context consumer
    // outside of the provider.
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};
