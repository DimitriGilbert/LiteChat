// src/components/LiteChat/prompt/PromptWrapper.tsx
import React, { useState, useCallback, useMemo } from "react";
import type {
  InputAreaRenderer,
  PromptTurnObject,
} from "@/types/litechat/prompt";
import { PromptControlWrapper } from "./PromptControlWrapper";
import { Button } from "@/components/ui/button";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { SendHorizonalIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/types/litechat/modding";
import { cn } from "@/lib/utils"; // Import cn

// Helper to run middleware (could be moved to a service/hook)
async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: ModMiddlewarePayloadMap[H],
): Promise<ModMiddlewareReturnMap[H]> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;

  for (const middleware of middlewareCallbacks) {
    try {
      // Ensure the callback receives the correct payload type
      const result = await middleware.callback(currentPayload as any); // Cast needed due to generic complexity
      if (result === false) {
        console.log(
          `Middleware ${middleware.modId} cancelled action for hook ${hookName}`,
        );
        return false as ModMiddlewareReturnMap[H]; // Return false to indicate cancellation
      }
      // Update payload only if middleware returned a new object
      if (result && typeof result === "object") {
        currentPayload = result as any; // Update payload, cast needed
      }
    } catch (error) {
      console.error(
        `Middleware error in mod ${middleware.modId} for hook ${hookName}:`,
        error,
      );
      // Optionally cancel on error, or just log and continue
      return false as ModMiddlewareReturnMap[H]; // Cancel on error
    }
  }
  // Return the final payload (potentially modified)
  return currentPayload as ModMiddlewareReturnMap[H];
}

interface PromptWrapperProps {
  InputAreaRenderer: InputAreaRenderer;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>; // Submit the turn data
  className?: string;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registeredControls = useControlRegistryStore(
    (state) => state.promptControls,
  );
  const isStreaming = useInteractionStore(
    (state) => state.status === "streaming",
  );

  const activeControls = useMemo(
    () =>
      Object.values(registeredControls)
        .filter((c) => (c.show ? c.show() : true))
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [registeredControls],
  );

  const clearInputs = useCallback(() => {
    setInputValue("");
    activeControls.forEach((c) => {
      if (c.clearOnSubmit) c.clearOnSubmit();
    });
  }, [activeControls]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmedInput = inputValue.trim();

      // Prevent submission if streaming
      if (isStreaming) {
        console.warn("Submit prevented: AI is currently streaming.");
        return;
      }

      setIsSubmitting(true);

      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedInput,
        parameters: {},
        metadata: {},
      };

      // 1. Collect parameters and metadata from active controls
      for (const control of activeControls) {
        if (control.getParameters) {
          try {
            const p = await control.getParameters();
            if (p) turnData.parameters = { ...turnData.parameters, ...p };
          } catch (err) {
            console.error(
              `Error getting parameters from control ${control.id}:`,
              err,
            );
          }
        }
        if (control.getMetadata) {
          try {
            const m = await control.getMetadata();
            if (m) turnData.metadata = { ...turnData.metadata, ...m };
          } catch (err) {
            console.error(
              `Error getting metadata from control ${control.id}:`,
              err,
            );
          }
        }
      }

      // Basic check for content (can be refined, e.g., check for file metadata)
      const hasContent =
        trimmedInput ||
        Object.keys(turnData.metadata).some((key) =>
          key.startsWith("fileRef:"),
        ); // Example check for file refs

      if (!hasContent) {
        console.warn("Submit prevented: No content (text or file refs).");
        setIsSubmitting(false);
        return;
      }

      emitter.emit("prompt:submitted", { turnData }); // Emit event before middleware

      // 2. Apply PROMPT_TURN_FINALIZE middleware
      const middlewareResult = await runMiddleware(
        "middleware:prompt:turnFinalize",
        { turnData },
      );

      // Check if middleware cancelled the submission
      if (middlewareResult === false) {
        console.log("Submission cancelled by middleware:prompt:turnFinalize.");
        setIsSubmitting(false);
        return;
      }

      // Ensure the result has the expected structure
      const finalTurnData =
        middlewareResult && typeof middlewareResult === "object"
          ? (middlewareResult as { turnData: PromptTurnObject }).turnData
          : turnData; // Fallback to original if middleware result is unexpected

      // 3. Final submission
      try {
        await onSubmit(finalTurnData);
        clearInputs(); // Clear inputs only on successful submission
      } catch (err) {
        console.error("Error during final prompt submission:", err);
        // Optionally show an error toast to the user here
      } finally {
        setIsSubmitting(false); // Always reset submitting state
      }
    },
    [inputValue, activeControls, onSubmit, isStreaming, clearInputs],
  );

  // Separate handler for the InputArea's onSubmit prop
  const handleInputSubmit = useCallback(() => {
    handleSubmit(); // Trigger the main form submission logic
  }, [handleSubmit]);

  return (
    <form onSubmit={handleSubmit} className={cn(className)}>
      {/* Render panel controls */}
      <PromptControlWrapper
        controls={activeControls}
        area="panel"
        className="p-2 border-b bg-muted/30" // Example styling
      />
      <div className="p-3 md:p-4 flex items-end gap-2">
        {/* Render the input area */}
        <InputAreaRenderer
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleInputSubmit} // Pass the specific handler
          disabled={isSubmitting || isStreaming}
        />
        <div className="flex flex-col items-center gap-1">
          {/* Render trigger controls */}
          <PromptControlWrapper controls={activeControls} area="trigger" />
          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || isStreaming || !inputValue.trim()} // Disable if no text input
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Send message"
          >
            <SendHorizonalIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </form>
  );
};
