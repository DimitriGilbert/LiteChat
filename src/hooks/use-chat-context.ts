import { useContext, createContext } from "react";
import type { ChatContextProps } from "@/lib/types";

export const ChatContext = createContext<ChatContextProps | undefined>(
  undefined,
);

export const useChatContext = (): ChatContextProps => {
  // ... (keep existing implementation)
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};
