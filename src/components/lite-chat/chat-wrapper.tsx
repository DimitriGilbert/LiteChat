import React from "react";
import { ChatContent } from "./chat-content"; // Assuming this exists
import { PromptWrapper } from "./prompt-wrapper";
import { ChatHeader } from "./chat-header"; // Import the new header
import { cn } from "@/lib/utils";

interface ChatWrapperProps {
  className?: string;
}

export const ChatWrapper: React.FC<ChatWrapperProps> = ({ className }) => {
  return (
    <main
      className={cn(
        "flex flex-grow flex-col bg-background overflow-hidden", // Added overflow-hidden
        className,
      )}
    >
      <ChatHeader />
      <ChatContent className="flex-grow h-0" /> <PromptWrapper />
    </main>
  );
};
