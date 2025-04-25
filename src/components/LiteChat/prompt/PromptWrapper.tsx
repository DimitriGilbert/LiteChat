import React, { useState, useCallback, useMemo } from "react";
import type {
  InputAreaRenderer,
  PromptTurnObject,
} from "@/types/litechat/prompt"; // Import PromptObject
import { PromptControlWrapper } from "./PromptControlWrapper";
import { Button } from "@/components/ui/button";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { SendHorizonalIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter"; // Import emitter
import type { ModMiddlewareHookName } from "@/types/litechat/modding";

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
      if (isStreaming) return;
      setIsSubmitting(true);

      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedInput,
        parameters: {},
        metadata: {},
      };

      // 1. Collect parameters and metadata
      for (const control of activeControls) {
        if (control.getParameters) {
          try {
            const p = await control.getParameters();
            if (p) turnData.parameters = { ...turnData.parameters, ...p };
          } catch (e) {
            console.error(e);
          }
        }
        if (control.getMetadata) {
          try {
            const m = await control.getMetadata();
            if (m) turnData.metadata = { ...turnData.metadata, ...m };
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Basic check for content (can be refined)
      const hasContent =
        trimmedInput ||
        Object.keys(turnData.metadata).some((key) =>
          key.startsWith("fileRef:"),
        );
      if (!hasContent) {
        setIsSubmitting(false);
        return;
      }

      emitter.emit("prompt:submitted", { turnData }); // Emit event before middleware

      // 2. Apply PROMPT_TURN_FINALIZE middleware
      const middlewareResult = await runMiddleware(
        "middleware:prompt:turnFinalize",
        { turnData },
      );
      if (middlewareResult === false) {
        setIsSubmitting(false);
        return;
      } // Cancelled by middleware
      const finalTurnData = middlewareResult.turnData as PromptTurnObject;

      // 3. Final submission
      try {
        await onSubmit(finalTurnData);
        clearInputs();
      } catch (e) {
        console.error("Final submit error:", e);
      } finally {
        setIsSubmitting(false);
      }
    },
    [inputValue, activeControls, onSubmit, isStreaming, clearInputs],
  );

  const handleInputSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  return (
    <form onSubmit={handleSubmit} className={className}>
      <PromptControlWrapper
        controls={activeControls}
        area="panel"
        className="p-2 border-b bg-muted/30"
      />
      <div className="p-3 md:p-4 flex items-end gap-2">
        <InputAreaRenderer
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleInputSubmit}
          disabled={isSubmitting || isStreaming}
        />
        <div className="flex flex-col items-center gap-1">
          <PromptControlWrapper controls={activeControls} area="trigger" />
          <Button
            type="submit"
            disabled={isSubmitting || isStreaming || !inputValue.trim()}
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

// Helper to run middleware (could be moved to a service/hook)
async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: any,
): Promise<any | false> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;
  for (const middleware of middlewareCallbacks) {
    try {
      const result = await middleware.callback(currentPayload);
      if (result === false) return false;
      currentPayload = result;
    } catch (error) {
      console.error(
        `Middleware error ${middleware.modId} for ${hookName}:`,
        error,
      );
      return false;
    }
  }
  return currentPayload;
}
