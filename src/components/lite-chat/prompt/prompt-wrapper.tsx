// src/components/lite-chat/prompt-wrapper.tsx
import React from "react";
import { PromptForm } from "./prompt-form";
import { useChatContext } from "@/hooks/use-chat-context";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptWrapperProps {
  className?: string;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({ className }) => {
  const { error } = useChatContext();

  return (
    <div className={cn("flex-shrink-0", className)}>
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-900/20 border-t border-red-800/30">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      <PromptForm />
    </div>
  );
};
