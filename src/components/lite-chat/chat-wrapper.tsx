import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "./prompt-wrapper";

interface ChatWrapperProps {
  className?: string;
}

export const ChatWrapper: React.FC<ChatWrapperProps> = ({ className }) => {
  return (
    <main className={`flex flex-grow flex-col bg-background ${className}`}>
      <ChatContent />
      <PromptWrapper />
    </main>
  );
};
