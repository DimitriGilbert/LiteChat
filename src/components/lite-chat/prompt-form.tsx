// src/components/lite-chat/prompt-form.tsx
import React, { useEffect } from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files";
import { SelectedVfsFilesDisplay } from "./selected-vfs-files-display";
import { PromptActions } from "./prompt-actions";
import { useChatContext } from "@/hooks/use-chat-context";
import { useChatInput } from "@/hooks/use-chat-input";
import { cn } from "@/lib/utils";

interface PromptFormProps {
  className?: string;
}

export const PromptForm: React.FC<PromptFormProps> = ({ className }) => {
  // Manage prompt/attached file state locally
  const {
    prompt,
    setPrompt,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
  } = useChatInput();

  // Get VFS selection state/actions and other needed items from context
  const {
    handleSubmit: contextHandleSubmit,
    isStreaming,
    isVfsEnabledForItem,
    selectedVfsPaths, // Get VFS state from context
    clearSelectedVfsPaths, // Get VFS action from context
  } = useChatContext();

  // Clear local VFS selection if VFS becomes disabled for the item
  useEffect(() => {
    // Safeguard against selectedVfsPaths being undefined during render cycles
    if (
      !isVfsEnabledForItem &&
      selectedVfsPaths &&
      selectedVfsPaths.length > 0
    ) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  // Handle form submission by calling the context function with local state
  const handleLocalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Pass local prompt/files and context VFS paths to the context handler
    contextHandleSubmit(prompt, attachedFiles, selectedVfsPaths).then(() => {
      // Clear local state after successful submission attempt
      setPrompt("");
      clearAttachedFiles();
      clearSelectedVfsPaths(); // Use context action
    });
  };

  return (
    <form
      onSubmit={handleLocalSubmit}
      className={cn("flex flex-col", className)}
    >
      {/* Pass local file state down */}
      <PromptFiles
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
      />

      {/* Render SelectedVfsFilesDisplay WITHOUT passing props */}
      {/* It will get its state directly from context */}
      <SelectedVfsFilesDisplay />

      <div className="flex items-end p-3 md:p-4">
        <PromptInput
          className="min-h-[60px]"
          prompt={prompt}
          setPrompt={setPrompt}
          isStreaming={isStreaming}
        />
        <PromptActions
          prompt={prompt}
          isStreaming={isStreaming}
          addAttachedFile={addAttachedFile} // Pass local file action
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <PromptSettings />
      </div>
    </form>
  );
};
