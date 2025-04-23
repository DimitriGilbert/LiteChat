
import React from "react";
import type { Message } from "@/lib/types";

interface MessageMetadataDisplayProps {
  message: Message;
}

export const MessageMetadataDisplay: React.FC<MessageMetadataDisplayProps> =
  React.memo(({ message }) => {
    // Only show for assistant messages
    if (message.role !== "assistant") {
      return null;
    }

    const showProvider = message.providerId && message.modelId;
    // Check if tokens are valid numbers before deciding to show
    const tokensInputValid =
      typeof message.tokensInput === "number" && !isNaN(message.tokensInput);
    const tokensOutputValid =
      typeof message.tokensOutput === "number" && !isNaN(message.tokensOutput);
    const showTokens = tokensInputValid || tokensOutputValid;
    const showSpeed =
      typeof message.tokensPerSecond === "number" &&
      !isNaN(message.tokensPerSecond);

    if (!showProvider && !showTokens && !showSpeed) {
      return null;
    }

    return (
      <div className="mt-2 opacity-0 group-hover/message:opacity-100 transition-opacity text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 select-none">
        {showProvider && (
          <span>
            {message.providerId}:
            <span className="ml-1 font-medium text-gray-400">
              {message.modelId}
            </span>
          </span>
        )}
        {showTokens && (
          <span>
            Tokens:
            {tokensInputValid && (
              <>
                {" "}
                In{" "}
                <strong className="text-gray-400">{message.tokensInput}</strong>
              </>
            )}
            {tokensOutputValid && (
              <>
                , Out{" "}
                <strong className="text-gray-400">
                  {message.tokensOutput}
                </strong>
              </>
            )}
          </span>
        )}
        {showSpeed && (
          <span>
            Speed:{" "}
            <strong className="text-gray-400">
              {message.tokensPerSecond?.toFixed(1)}
            </strong>{" "}
            tok/s
          </span>
        )}
      </div>
    );
  });
MessageMetadataDisplay.displayName = "MessageMetadataDisplay";
