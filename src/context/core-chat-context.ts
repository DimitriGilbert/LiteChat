import { createContext, useContext } from "react";
import type { CoreChatContextProps } from "@/lib/types";

export const CoreChatContext = createContext<CoreChatContextProps | undefined>(
  undefined,
);

export const useCoreChatContext = (): CoreChatContextProps => {
  const context = useContext(CoreChatContext);
  if (context === undefined) {
    throw new Error(
      "useCoreChatContext must be used within a CoreChatProvider (implicitly via ChatProvider)",
    );
  }
  return context;
};
