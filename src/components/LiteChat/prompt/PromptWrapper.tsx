// src/components/LiteChat/prompt/PromptWrapper.tsx
// Entire file content provided
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
  // Only need attachedFilesMetadata and clearAttachedFiles from InputStore
  const { attachedFilesMetadata, clearAttachedFiles } = useInputStore(
    useShallow((state) => ({
      attachedFilesMetadata: state.attachedFilesMetadata,
      clearAttachedFiles: state.clearAttachedFiles,
    })),
  );

  // Focus input when flag is set
  useEffect(() => {
    if (focusInputOnNextRender && inputAreaRef.current) {
      inputAreaRef.current.focus();
      setFocusInputFlag(false);
    }
  }, [focusInputOnNextRender, setFocusInputFlag]);

  // Memoize controls
  const promptControls = useMemo(() => {
    return Object.values(registeredPromptControls)
      .filter((c) => (c.show ? c.show() : true))
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  }, [registeredPromptControls]);

  const panelControls = useMemo(
    () => promptControls.filter((c) => c.renderer),
    [promptControls],
  );
  const triggerControls = useMemo(
    () => promptControls.filter((c) => c.triggerRenderer),
    [promptControls],
  );

  const handleSubmit = useCallback(async () => {
    const currentInputValue = inputAreaRef.current?.getValue() ?? "";
    const trimmedValue = currentInputValue.trim();

    if (!trimmedValue && attachedFilesMetadata.length === 0) {
      return;
    }
    if (isStreaming || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let parameters: Record<string, any> = {};
      let metadata: Record<string, any> = {};

      // Collect parameters and metadata from all controls
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

      // Add attached files metadata (from InputStore)
      if (attachedFilesMetadata.length > 0) {
        metadata.attachedFiles = [...attachedFilesMetadata];
      }

      // Construct the initial turn data
      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedValue,
        parameters,
        metadata, // Metadata now includes data from controls like tools, steps, system prompt
      };

      emitter.emit("prompt:submitted", { turnData });

      // Run middleware
      const middlewareResult = await runMiddleware(
        "middleware:prompt:turnFinalize",
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

      // Call the main onSubmit handler (passed from LiteChat)
      await onSubmit(finalTurnData);

      // --- Clear State AFTER successful submission initiation ---
      // InputArea clears itself internally now

      // Clear attached files from InputStore
      clearAttachedFiles();

      // Call clearOnSubmit for relevant controls to reset their local state
      promptControls.forEach((control) => {
        if (control.clearOnSubmit) {
          control.clearOnSubmit();
        }
      });

      // Focus input for the next turn
      setFocusInputFlag(true);
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
    promptControls,
    onSubmit,
    attachedFilesMetadata,
    clearAttachedFiles,
    setFocusInputFlag,
  ]);

  return (
    <div className={cn("p-4 space-y-3", className)}>
      {/* Panel Controls Area (Above Input) */}
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
        onSubmit={handleSubmit}
        disabled={isStreaming || isSubmitting}
        placeholder={placeholder}
      />

      {/* Trigger Controls and Submit Button Area (Below Input) */}
      <div className="flex items-center justify-between gap-2 mt-2">
        {/* Trigger Controls Area */}
        <PromptControlWrapper
          controls={triggerControls}
          area="trigger"
          className="flex items-center gap-1 flex-shrink-0"
        />
        {/* Spacer to push button to the right */}
        <div className="flex-grow"></div>
        {/* Submit Button */}
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={
            isStreaming ||
            isSubmitting ||
            ((inputAreaRef.current?.getValue() ?? "").trim().length === 0 &&
              attachedFilesMetadata.length === 0)
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
