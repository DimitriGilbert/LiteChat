// src/components/LiteChat/canvas/UserPromptDisplay.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import { UserIcon } from "lucide-react";

interface UserPromptDisplayProps {
  interaction: Interaction;
  className?: string;
}

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = ({
  interaction,
  className,
}) => {
  const userContent =
    interaction.prompt?.content &&
    typeof interaction.prompt.content === "string"
      ? interaction.prompt.content
      : "[User content unavailable]";

  return (
    <div className={cn("flex items-start gap-3 my-2", className)}>
      {/* Avatar */}
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
        <UserIcon className="h-5 w-5" />
      </div>

      {/* Bubble Container */}
      <div className="p-3 border rounded-md shadow-sm bg-muted/50 flex-grow min-w-0">
        {" "}
        {/* Added min-w-0 */}
        {/* Content inside the bubble */}
        <pre className="text-sm whitespace-pre-wrap break-words">
          {" "}
          {/* Added break-words */}
          {userContent}
        </pre>
        {/* Display attached files or other metadata if needed */}
        {interaction.prompt?.metadata?.attachedFileCount > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            ({interaction.prompt?.metadata.attachedFileCount} file(s))
          </div>
        )}
      </div>
    </div>
  );
};
