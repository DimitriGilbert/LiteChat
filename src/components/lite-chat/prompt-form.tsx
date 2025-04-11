// src/components/lite-chat/prompt-form.tsx
import React, { useEffect } from "react"; // Added useEffect
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files";
import { SelectedVfsFilesDisplay } from "./selected-vfs-files-display";
import { PromptActions } from "./prompt-actions";
import { useChatContext } from "@/hooks/use-chat-context";
import { useChatInput } from "@/hooks/use-chat-input"; // Import hook here
import { cn } from "@/lib/utils";

interface PromptFormProps {
  className?: string;
  // REMOVED props for prompt state
}

export const PromptForm: React.FC<PromptFormProps> = ({
  className,
  // REMOVED prompt state props
}) => {
  // Manage input state locally within the form area
  const chatInput = useChatInput();
  const {
    prompt,
    setPrompt,
    attachedFiles,
    selectedVfsPaths,
    clearAttachedFiles,
    clearSelectedVfsPaths,
  } = chatInput;

  // Get necessary functions/state from context
  const {
    handleSubmit: contextHandleSubmit,
    isStreaming,
    isVfsEnabledForItem,
  } = useChatContext();

  // Clear local VFS selection if VFS becomes disabled for the item
  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  // Handle form submission by calling the context function with local state
  const handleLocalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    contextHandleSubmit(prompt, attachedFiles, selectedVfsPaths).then(() => {
      // Clear local state after successful submission attempt
      setPrompt("");
      clearAttachedFiles();
      clearSelectedVfsPaths();
    });
  };

  return (
    <form
      onSubmit={handleLocalSubmit}
      className={cn("flex flex-col", className)}
    >
      {/* Pass local state down */}
      <PromptFiles
        attachedFiles={attachedFiles}
        removeAttachedFile={chatInput.removeAttachedFile}
      />
      <SelectedVfsFilesDisplay
        selectedVfsPaths={selectedVfsPaths}
        removeSelectedVfsPath={chatInput.removeSelectedVfsPath}
      />

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
          addAttachedFile={chatInput.addAttachedFile} // Pass file action
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <PromptSettings />
      </div>
    </form>
  );
};
