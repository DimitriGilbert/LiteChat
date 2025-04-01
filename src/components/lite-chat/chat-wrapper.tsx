// src/components/lite-chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "./prompt-wrapper";
import { Input } from "@/components/ui/input";
import { useChatContext } from "@/hooks/use-chat-context";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatWrapperProps {
  className?: string;
}

export const ChatWrapper: React.FC<ChatWrapperProps> = ({ className }) => {
  const { searchTerm, setSearchTerm } = useChatContext();

  return (
    <main className={cn("flex flex-col h-full bg-gray-900", className)}>
      {/* Search Bar - Optional, can be toggled */}
      {searchTerm !== undefined && (
        <div className="flex items-center gap-2 border-b border-gray-700 p-2 bg-gray-800">
          <SearchIcon className="h-4 w-4 text-gray-400 ml-2" />
          <Input
            type="search"
            placeholder="Search in conversation..."
            className="h-9 flex-grow bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
              onClick={() => setSearchTerm("")}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Messages Area - Scrollable */}
      <div className="flex-grow overflow-hidden relative">
        <ChatContent className="absolute inset-0" />
      </div>

      {/* Prompt Area - Fixed at Bottom */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800">
        <PromptWrapper />
      </div>
    </main>
  );
};
