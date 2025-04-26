// src/components/LiteChat/canvas/UserPromptDisplay.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import { UserIcon } from "lucide-react"; // Or use an Avatar component

interface UserPromptDisplayProps {
  interaction: Interaction; // The user interaction
  className?: string;
}

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = ({
  interaction,
  className,
}) => {
  // Extract user prompt content
  const userContent =
    interaction.prompt?.content &&
    typeof interaction.prompt.content === "string"
      ? interaction.prompt.content
      : "[User content unavailable]";

  // TODO: Handle multi-modal content display if needed

  return (
    <div className={cn("flex items-start gap-3 my-2", className)}>
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
        <UserIcon className="h-5 w-5" />
      </div>
      <div className="p-3 border rounded-md shadow-sm bg-muted/50 flex-grow">
        {/* Header Info - Optional */}
        {/* <div className="text-xs text-muted-foreground mb-1">
                    User | Idx: {interaction.index}
                </div> */}
      </div>
      <pre className="text-sm whitespace-pre-wrap">{userContent}</pre>
      {/* Display attached files or other metadata if needed */}
      {interaction.prompt?.metadata?.attachedFileCount > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          ({interaction.prompt?.metadata.attachedFileCount} file(s))
        </div>
      )}
    </div>
  );
};
