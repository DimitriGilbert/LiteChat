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
import { useInputStore } from "@/store/input.store";

// Helper to run middleware
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

  const handleClearInputs = useCallback(() => {
    clearAllInput();
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

      // Filter selectedVfsFiles to ensure path is defined before mapping,
      // because PromptTurnObject requires path to be a string.
      const validSelectedVfsFiles = selectedVfsFiles.filter(
        (f): f is typeof f & { path: string } => typeof f.path === "string",
      );

      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedInput,
        parameters: {},
        metadata: {
          // Map standard File properties. Removed 'id' access which caused error.
          attachedFiles: attachedFiles.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
            // If an ID is needed here, it must be added to the objects in InputStore
            // or the PromptTurnObject type definition needs changing.
          })),
          // Map only the VFS files that have a valid string path.
          selectedVfsFiles: validSelectedVfsFiles.map((f) => ({
            id: f.id, // Assuming VfsObject from store *does* have id
            name: f.name,
            path: f.path, // Path is guaranteed to be a string here due to filter
            type: f.type,
          })),
        },
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

      // Merge control metadata into the existing metadata, potentially overwriting
      // file lists if a control explicitly provides them.
      turnData.metadata = activeControls.reduce(
        (acc, control) => {
          if (control.getMetadata) {
            // Note: This synchronous access might need adjustment if getMetadata is async
            // For simplicity here, assuming sync or handled within the loop above
            // Re-evaluating this part based on actual getMetadata implementation might be needed.
            // Let's stick to the loop above for async safety for now.
          }
          return acc; // Placeholder, actual merge happens in the loop above
        },
        turnData.metadata, // Start with the initially constructed metadata
      );

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
        handleClearInputs();
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
      attachedFiles,
      selectedVfsFiles,
    ],
  );

  const handleInputSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const hasPanelControls = activeControls.some((c) => !!c.renderer);
  const hasTriggerControls = activeControls.some((c) => !!c.triggerRenderer);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col border-t border-border bg-background",
        className,
      )}
    >
      {/* Area for Panel Renderers (e.g., file previews) - Renders ABOVE Input */}
      {hasPanelControls && (
        <div className="p-2 border-b border-border bg-muted/30">
          <PromptControlWrapper controls={activeControls} area="panel" />
        </div>
      )}

      {/* Input Area and Submit Button Row */}
      <div className="p-3 md:p-4 flex items-end gap-2">
        {/* Input Area takes up most space */}
        <div className="flex-grow">
          <InputAreaRenderer
            value={promptInputValue}
            onChange={setPromptInputValue}
            onSubmit={handleInputSubmit}
            disabled={isSubmitting || isStreaming}
          />
        </div>

        {/* Submit Button */}
        <div className="flex-shrink-0">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              isStreaming ||
              (!promptInputValue.trim() &&
                attachedFiles.length === 0 &&
                selectedVfsFiles.length === 0)
            }
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Send message"
          >
            <SendHorizonalIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Area for Trigger Controls - Renders BENEATH Input/Submit Row */}
      {hasTriggerControls && (
        <div className="px-3 md:px-4 pb-2 pt-1">
          <PromptControlWrapper controls={activeControls} area="trigger" />
        </div>
      )}
    </form>
  );
};
