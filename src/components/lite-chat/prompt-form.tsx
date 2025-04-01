import React from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files"; // Import
import { PromptActions } from "./prompt-actions";
import { useChatContext } from "@/hooks/use-chat-context";
import { cn } from "@/lib/utils";

interface PromptFormProps {
  className?: string;
}

export const PromptForm: React.FC<PromptFormProps> = ({ className }) => {
  const { handleSubmit } = useChatContext();

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col", className)}>
      <PromptFiles />

      <div className="flex items-end p-3 md:p-4">
        <PromptInput className="min-h-[60px]" />
        <PromptActions />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <PromptSettings />
      </div>
    </form>
  );
};
