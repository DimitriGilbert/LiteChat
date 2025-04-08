// src/components/lite-chat/prompt-form.tsx
import React from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files"; // For direct uploads
import { SelectedVfsFilesDisplay } from "./selected-vfs-files-display"; // Import VFS selection display
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
      {/* Display for temporary file uploads */}
      <PromptFiles />

      {/* Display for selected VFS files for context */}
      <SelectedVfsFilesDisplay />

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
