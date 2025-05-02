// src/components/LiteChat/prompt/PromptWrapper.tsx
// FULL FILE
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, Loader2 } from "lucide-react";
import { PromptControlWrapper } from "./PromptControlWrapper";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useUIStateStore } from "@/store/ui.store";
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
import { ModEvent, ModMiddlewareHook } from "@/types/litechat/modding"; // Import Enums

interface PromptWrapperProps {
  InputAreaRenderer: InputAreaRenderer;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
  placeholder?: string;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
  placeholder = "Send a message...",
}) => {
  const inputAreaRef = useRef<InputAreaRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Local state to track if input has value for disabling submit button
  const [hasInputValue, setHasInputValue] = useState(false);

  // --- Store Hooks ---
  const registeredPromptControls = useControlRegistryStore(
    useShallow((state) => state.promptControls),
  );
  const isStreaming = useInteractionStore(
    useShallow((state) => state.status === "streaming"),
  );
  const { focusInputOnNextRender, setFocusInputFlag } = useUIStateStore(
    useShallow((state) => ({
      focusInputOnNextRender: state.focusInputOnNextRender,
      setFocusInputFlag: state.setFocusInputFlag,
    })),
  );
  const { attachedFilesMetadata, clearAttachedFiles } = useInputStore(
    useShallow((state) => ({
      attachedFilesMetadata: state.attachedFilesMetadata,
      clearAttachedFiles: state.clearAttachedFiles,
    })),
  );

  // --- Focus Handling ---
  useEffect(() => {
    if (focusInputOnNextRender && inputAreaRef.current) {
      inputAreaRef.current.focus();
      setFocusInputFlag(false);
    }
  }, [focusInputOnNextRender, setFocusInputFlag]);

  // --- Memoized Controls ---
  const promptControls = useMemo(() => {
    // Filter based on show function IF IT EXISTS
    // Rely on registration order, remove sort
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
    // Read value directly from ref for submission
    const valueFromRef = inputAreaRef.current?.getValue() ?? "";
    const trimmedValue = valueFromRef.trim();

    // Read attached files directly from store state at submission time
    const currentAttachedFiles = useInputStore.getState().attachedFilesMetadata;

    if (!trimmedValue && currentAttachedFiles.length === 0) {
      return;
    }
    if (isStreaming || isSubmitting) return;

    setIsSubmitting(true);
    // InputArea will clear itself and call onValueChange("")
    try {
      let parameters: Record<string, any> = {};
      let metadata: Record<string, any> = {};

      // Use the memoized promptControls list
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

      // Use enum member for event name
      emitter.emit(ModEvent.PROMPT_SUBMITTED, { turnData });

      // Use enum member for middleware hook name
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

      // Clear state AFTER successful submission initiation
      clearAttachedFiles(); // This will emit ATTACHED_FILES_CHANGED
      promptControls.forEach((control) => {
        if (control.clearOnSubmit) {
          control.clearOnSubmit(); // This should trigger relevant state resets/events
        }
      });
      setFocusInputFlag(true);
      // InputArea clears itself internally on submit now
      setHasInputValue(false); // Reset local state for button disable
    } catch (error) {
      console.error("Error during prompt submission:", error);
      toast.error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isStreaming,
    isSubmitting,
    promptControls, // Use memoized list
    onSubmit,
    clearAttachedFiles,
    setFocusInputFlag,
  ]);

  // Callback for InputArea to update local state and emit event
  const handleInputValueChange = useCallback((value: string) => {
    setHasInputValue(value.trim().length > 0);
    emitter.emit(ModEvent.PROMPT_INPUT_CHANGE, { value });
  }, []);

  return (
    <div className={cn("p-4 space-y-3", className)}>
      {/* Panel Controls Area */}
      {panelControls.length > 0 && (
        <PromptControlWrapper
          controls={panelControls}
          area="panel"
          className="flex flex-wrap gap-2 items-start mb-2"
        />
      )}

      {/* Input Area */}
      <InputAreaRenderer
        ref={inputAreaRef}
        onSubmit={handleSubmit} // Pass the submit handler
        disabled={isStreaming || isSubmitting}
        placeholder={placeholder}
        onValueChange={handleInputValueChange} // Pass the callback to update state and emit event
      />

      {/* Trigger Controls and Submit Button Area */}
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
            (!hasInputValue && attachedFilesMetadata.length === 0) // Use local state for check
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
