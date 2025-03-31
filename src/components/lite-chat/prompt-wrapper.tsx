import React from "react";
import { PromptForm } from "./prompt-form";
import { useChatContext } from "@/context/chat-context";
import { AlertCircle } from "lucide-react";

interface PromptWrapperProps {
  className?: string;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({ className }) => {
  const { error } = useChatContext(); // Get global error state

  return (
    <div className={`flex-shrink-0 border-t bg-background ${className}`}>
      <PromptForm />
      {/* Display Global Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 text-sm text-destructive bg-destructive/10 border-t border-destructive/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
