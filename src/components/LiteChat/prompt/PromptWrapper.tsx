// src/components/LiteChat/prompt/PromptWrapper.tsx
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  RefObject, // Import RefObject
} from "react";
import type {
  InputAreaRenderer,
  PromptTurnObject,
  InputAreaRendererProps, // Import props type for renderer
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

// Middleware runner remains the same
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
  // Ensure InputAreaRenderer type accepts the ref
  InputAreaRenderer: React.ForwardRefExoticComponent<
    InputAreaRendererProps & React.RefAttributes<HTMLTextAreaElement>
  >;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
  inputRef?: RefObject<HTMLTextAreaElement>; // Accept the ref again
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
  inputRef, // Receive the ref
}) => {
  const [inputValue, setInputValue] = useState("");
  const { attachedFiles, selectedVfsFiles, clearAllInput } = useInputStore();
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
    setInputValue("");
    clearAllInput();
    activeControls.forEach((c) => {
      if (c.clearOnSubmit) c.clearOnSubmit();
    });
  }, [activeControls, clearAllInput]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmedInput = inputValue.trim();

      if (isStreaming) {
        console.warn("Submit prevented: AI is currently streaming.");
        return;
      }

      const hasContent =
        trimmedInput || attachedFiles.length > 0 || selectedVfsFiles.length > 0;

      if (!hasContent) {
        console.warn("Submit prevented: No content provided.");
        return;
      }

      setIsSubmitting(true);

      const validSelectedVfsFiles = selectedVfsFiles.filter(
        (f): f is typeof f & { path: string } => typeof f.path === "string",
      );

      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedInput,
        parameters: {},
        metadata: {
          attachedFiles: attachedFiles.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })),
          selectedVfsFiles: validSelectedVfsFiles.map((f) => ({
            id: f.id,
            name: f.name,
            path: f.path,
            type: f.type,
          })),
        },
      };

      const currentControls = useControlRegistryStore.getState().promptControls;
      const currentActiveControls = Object.values(currentControls)
        .filter((c) => (c.show ? c.show() : true))
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

      for (const control of currentActiveControls) {
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

      emitter.emit("prompt:submitted", { turnData });

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
      inputValue,
      activeControls,
      onSubmit,
      isStreaming,
      handleClearInputs,
      attachedFiles,
      selectedVfsFiles,
    ],
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleInputSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const hasPanelControls = activeControls.some((c) => !!c.renderer);
  const hasTriggerControls = activeControls.some((c) => !!c.triggerRenderer);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col border-t border-[--border] bg-background",
        className,
      )}
    >
      {hasPanelControls && (
        <div className="p-2 border-b border-[--border] bg-muted/30">
          <PromptControlWrapper controls={activeControls} area="panel" />
        </div>
      )}

      <div className="p-3 md:p-4 flex items-end gap-2">
        <div className="flex-grow">
          {/* Pass the ref down to the renderer */}
          <InputAreaRenderer
            ref={inputRef} // Pass the ref here
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handleInputSubmit}
            disabled={isSubmitting || isStreaming}
          />
        </div>

        <div className="flex-shrink-0">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              isStreaming ||
              (!inputValue.trim() &&
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

      {hasTriggerControls && (
        <div className="px-3 md:px-4 pb-2 pt-1 flex flex-wrap gap-1">
          <PromptControlWrapper controls={activeControls} area="trigger" />
        </div>
      )}
    </form>
  );
};
