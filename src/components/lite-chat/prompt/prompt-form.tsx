// src/components/lite-chat/prompt-form.tsx
import React, { useEffect } from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files";
import { SelectedVfsFilesDisplay } from "@/components/lite-chat/selected-vfs-files-display";
import { PromptActions } from "./prompt-actions";
import { useChatContext } from "@/hooks/use-chat-context";
import { useChatInput } from "@/hooks/use-chat-input";
import { cn } from "@/lib/utils";

interface PromptFormProps {
  className?: string;
}

export const PromptForm: React.FC<PromptFormProps> = ({ className }) => {
  const {
    prompt,
    setPrompt,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
  } = useChatInput();

  const {
    handleSubmit: contextHandleSubmit,
    isStreaming,
    isVfsEnabledForItem,
    selectedVfsPaths,
    clearSelectedVfsPaths,
  } = useChatContext();

  useEffect(() => {
    if (
      !isVfsEnabledForItem &&
      selectedVfsPaths &&
      selectedVfsPaths.length > 0
    ) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  const handleLocalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    contextHandleSubmit(prompt, attachedFiles, selectedVfsPaths).then(() => {
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
      <PromptFiles
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
      />
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
          addAttachedFile={addAttachedFile}
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <PromptSettings />
      </div>
    </form>
  );
};
