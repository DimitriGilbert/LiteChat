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
import { cn } from "@/lib/utils";
import { useInputStore } from "@/store/input.store"; // Import InputStore

// Helper to run middleware (keep as is)
async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: ModMiddlewarePayloadMap[H],
): Promise<ModMiddlewareReturnMap[H]> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;

  for (const middleware of middlewareCallbacks) {
    try {
      const result = await middleware.callback(currentPayload as any);
      if (result === false) {
        console.log(
          `Middleware ${middleware.modId} cancelled action for hook ${hookName}`,
        );
        return false as ModMiddlewareReturnMap[H];
      }
      if (result && typeof result === "object") {
        currentPayload = result as any;
      }
    } catch (error) {
      console.error(
        `Middleware error in mod ${middleware.modId} for hook ${hookName}:`,
        error,
      );
      return false as ModMiddlewareReturnMap[H];
    }
  }
  return currentPayload as ModMiddlewareReturnMap[H];
}

interface PromptWrapperProps {
  InputAreaRenderer: InputAreaRenderer;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
}) => {
  // Use InputStore for input value and clearing
  const {
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    selectedVfsFiles,
    clearAllInput,
  } = useInputStore();

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

  // Clear inputs using InputStore action
  const handleClearInputs = useCallback(() => {
    clearAllInput(); // Use the combined clear action
    // Also call control-specific clear functions
    activeControls.forEach((c) => {
      if (c.clearOnSubmit) c.clearOnSubmit();
    });
  }, [activeControls, clearAllInput]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmedInput = promptInputValue.trim();

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

      // Check for content (text, attached files, or VFS files)
      const hasContent =
        trimmedInput || attachedFiles.length > 0 || selectedVfsFiles.length > 0;

      if (!hasContent) {
        console.warn("Submit prevented: No content provided.");
        setIsSubmitting(false);
        return;
      }

      emitter.emit("prompt:submitted", { turnData });

      // 2. Apply PROMPT_TURN_FINALIZE middleware
      const middlewareResult = await runMiddleware(
        "middleware:prompt:turnFinalize",
        { turnData },
      );

      if (middlewareResult === false) {
        console.log("Submission cancelled by middleware:prompt:turnFinalize.");
        setIsSubmitting(false);
        return;
      }

      const finalTurnData =
        middlewareResult && typeof middlewareResult === "object"
          ? (middlewareResult as { turnData: PromptTurnObject }).turnData
          : turnData;

      // 3. Final submission
      try {
        await onSubmit(finalTurnData);
        handleClearInputs(); // Clear inputs on successful submission
      } catch (err) {
        console.error("Error during final prompt submission:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      promptInputValue,
      activeControls,
      onSubmit,
      isStreaming,
      handleClearInputs,
      attachedFiles.length, // Add dependencies from InputStore
      selectedVfsFiles.length,
    ],
  );

  const handleInputSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const hasPanelControls = activeControls.some((c) => !!c.renderer);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col", className)} // Use flex-col for main layout
    >
      {/* Area for Panel Renderers (e.g., file previews) - Below Input */}
      {hasPanelControls && (
        <div className="p-2 border-b bg-muted/30">
          <PromptControlWrapper controls={activeControls} area="panel" />
        </div>
      )}

      {/* Input Area and Triggers/Submit Button */}
      <div className="p-3 md:p-4 flex items-end gap-2">
        {/* Input Area takes up most space */}
        <div className="flex-grow">
          <InputAreaRenderer
            value={promptInputValue}
            onChange={setPromptInputValue} // Use action from InputStore
            onSubmit={handleInputSubmit}
            disabled={isSubmitting || isStreaming}
          />
        </div>

        {/* Container for Triggers and Submit Button */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Render trigger controls */}
          <PromptControlWrapper controls={activeControls} area="trigger" />
          {/* Submit Button */}
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              isStreaming ||
              (!promptInputValue.trim() &&
                attachedFiles.length === 0 &&
                selectedVfsFiles.length === 0) // Disable if no content at all
            }
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
