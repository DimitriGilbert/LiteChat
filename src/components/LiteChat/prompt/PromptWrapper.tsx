// src/components/LiteChat/prompt/PromptWrapper.tsx
// FULL FILE
import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, Loader2 } from "lucide-react";
import { PromptControlWrapper } from "./PromptControlWrapper";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
// UIStateStore import removed
import { useInputStore } from "@/store/input.store";
import type {
  PromptTurnObject,
  InputAreaRenderer,
  InputAreaRef,
} from "@/types/litechat/prompt";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import { runMiddleware } from "@/lib/litechat/ai-helpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { ModEvent, ModMiddlewareHook } from "@/types/litechat/modding";

interface PromptWrapperProps {
  InputAreaRenderer: InputAreaRenderer;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
  placeholder?: string;
  // Add prop to receive the ref from LiteChat
  inputAreaRef: React.RefObject<InputAreaRef | null>;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
  placeholder = "Send a message...",
  inputAreaRef, // Receive the ref
}) => {
  // inputAreaRef is now passed from parent
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInputValue, setHasInputValue] = useState(false);

  // --- Store Hooks ---
  const registeredPromptControls = useControlRegistryStore(
    useShallow((state) => state.promptControls),
  );
  const isStreaming = useInteractionStore(
    useShallow((state) => state.status === "streaming"),
  );
  // focusInputOnNextRender/setFocusInputFlag removed
  const { attachedFilesMetadata, clearAttachedFiles } = useInputStore(
    useShallow((state) => ({
      attachedFilesMetadata: state.attachedFilesMetadata,
      clearAttachedFiles: state.clearAttachedFiles,
    })),
  );

  // --- Focus Handling Removed ---
  // useEffect for focusInputOnNextRender removed

  // --- Memoized Controls ---
  const promptControls = useMemo(() => {
    return Object.values(registeredPromptControls).filter((c) =>
      c.show ? c.show() : true,
    );
  }, [registeredPromptControls]);

  const panelControls = useMemo(
    () => promptControls.filter((c) => c.renderer),
    [promptControls],
  );
  const triggerControls = useMemo(
    () => promptControls.filter((c) => c.triggerRenderer),
    [promptControls],
  );

  // --- Submission Logic ---
  const handleSubmit = useCallback(async () => {
    const valueFromRef = inputAreaRef?.current?.getValue() ?? "";
    const trimmedValue = valueFromRef.trim();
    const currentAttachedFiles = useInputStore.getState().attachedFilesMetadata;

    if (!trimmedValue && currentAttachedFiles.length === 0) {
      return;
    }
    if (isStreaming || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let parameters: Record<string, any> = {};
      let metadata: Record<string, any> = {};

      for (const control of promptControls) {
        if (control.getParameters) {
          const params = await control.getParameters();
          if (params) parameters = { ...parameters, ...params };
        }
        if (control.getMetadata) {
          const meta = await control.getMetadata();
          if (meta) metadata = { ...metadata, ...meta };
        }
      }

      if (currentAttachedFiles.length > 0) {
        metadata.attachedFiles = [...currentAttachedFiles];
      }

      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedValue,
        parameters,
        metadata,
      };

      emitter.emit(ModEvent.PROMPT_SUBMITTED, { turnData });

      const middlewareResult = await runMiddleware(
        ModMiddlewareHook.PROMPT_TURN_FINALIZE,
        { turnData },
      );

      if (middlewareResult === false) {
        console.log("Prompt submission cancelled by middleware.");
        setIsSubmitting(false);
        return;
      }

      const finalTurnData =
        middlewareResult && typeof middlewareResult === "object"
          ? (middlewareResult as { turnData: PromptTurnObject }).turnData
          : turnData;

      await onSubmit(finalTurnData);

      clearAttachedFiles();
      promptControls.forEach((control) => {
        if (control.clearOnSubmit) {
          control.clearOnSubmit();
        }
      });
      // Focus is now handled by the caller (LiteChat)
      setHasInputValue(false);
    } catch (error) {
      console.error("Error during prompt submission:", error);
      toast.error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    inputAreaRef, // Add ref dependency
    isStreaming,
    isSubmitting,
    promptControls,
    onSubmit,
    clearAttachedFiles,
  ]);

  const handleInputValueChange = useCallback((value: string) => {
    setHasInputValue(value.trim().length > 0);
    emitter.emit(ModEvent.PROMPT_INPUT_CHANGE, { value });
  }, []);

  return (
    <div className={cn("p-4 space-y-3", className)}>
      {panelControls.length > 0 && (
        <PromptControlWrapper
          controls={panelControls}
          area="panel"
          className="flex flex-wrap gap-2 items-start mb-2"
        />
      )}

      <InputAreaRenderer
        // Pass the ref down to the actual InputArea component
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        disabled={isStreaming || isSubmitting}
        placeholder={placeholder}
        onValueChange={handleInputValueChange}
      />

      <div className="flex items-center justify-between gap-2 mt-2">
        <PromptControlWrapper
          controls={triggerControls}
          area="trigger"
          className="flex items-center gap-1 flex-shrink-0"
        />
        <div className="flex-grow"></div>
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={
            isStreaming ||
            isSubmitting ||
            (!hasInputValue && attachedFilesMetadata.length === 0)
          }
          className="h-9 w-9 flex-shrink-0"
          aria-label="Send message"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonalIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
