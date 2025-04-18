// src/components/lite-chat/message-error-display.tsx
import React from "react";
import { AlertCircle } from "lucide-react";

interface MessageErrorDisplayProps {
  error: string | null | undefined;
}

export const MessageErrorDisplay: React.FC<MessageErrorDisplayProps> =
  React.memo(({ error }) => {
    if (!error) {
      return null;
    }
    return (
      <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  });
MessageErrorDisplay.displayName = "MessageErrorDisplay";
