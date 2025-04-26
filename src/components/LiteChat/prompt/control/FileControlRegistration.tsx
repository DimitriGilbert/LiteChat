// src/components/LiteChat/prompt/control/FileControlRegistration.tsx
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useInputStore } from "@/store/input.store";
import type { PromptControl } from "@/types/litechat/prompt";
import { useShallow } from "zustand/react/shallow";
// Removed unused toast import

export const useFileControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  // Get actions and state needed for the control logic
  const { addAttachedFile, clearAttachedFiles } = useInputStore(
    useShallow((state) => ({
      addAttachedFile: state.addAttachedFile,
      clearAttachedFiles: state.clearAttachedFiles,
      // attachedFiles: state.attachedFiles, // Removed unused state selector
    })),
  );

  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        addAttachedFile(files[i]); // Use action from store
      }
      // Reset input value to allow selecting the same file again
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-file-control",
      // Removed status property
      triggerRenderer: () => (
        <>
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
          {/* Visible trigger button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAttachClick}
            className="h-10 w-10 rounded-full"
            aria-label="Attach file"
          >
            <PaperclipIcon className="h-5 w-5" />
          </Button>
          modelpro
        </>
      ),
      // No separate renderer needed, PromptForm handles display
      show: () => true, // Always show the attach button
      getMetadata: () => {
        // Provide count as metadata, actual files handled by PromptForm/Wrapper
        const count = useInputStore.getState().attachedFiles.length;
        // Return undefined instead of null
        return count > 0 ? { attachedFileCount: count } : undefined;
      },
      clearOnSubmit: () => {
        clearAttachedFiles(); // Use action from store
      },
      order: 30, // Example order
    };

    const unregister = register(control);
    return unregister;
    // Re-register if actions change (unlikely but good practice)
  }, [register, addAttachedFile, clearAttachedFiles, handleFileChange]);

  return null; // This hook doesn't render anything itself
};
