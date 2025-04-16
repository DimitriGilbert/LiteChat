// src/hooks/use-chat-context.ts
import { useContext, createContext } from "react";
import type { ChatContextProps } from "@/lib/types"; // Type definition updated previously

export const ChatContext = createContext<ChatContextProps | undefined>(
  undefined,
);

export const useChatContext = (): ChatContextProps => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};
