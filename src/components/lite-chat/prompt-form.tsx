import React from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files"; // Import
import { PromptActions } from "./prompt-actions";
import { useChatContext } from "@/context/chat-context";
import { Separator } from "@/components/ui/separator";

interface PromptFormProps {
  className?: string;
}

export const PromptForm: React.FC<PromptFormProps> = ({ className }) => {
  const { handleSubmit } = useChatContext();

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-0 ${className}`} // Remove space-y here
    >
      {/* Display selected files above input */}
      <PromptFiles />

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        {" "}
        {/* Add padding */}
        <PromptInput />
        <PromptActions />
      </div>

      {/* Settings below */}
      <Separator />
      <div className="px-3 py-2">
        {" "}
        {/* Add padding */}
        <PromptSettings />
      </div>
    </form>
  );
};
