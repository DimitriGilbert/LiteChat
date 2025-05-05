// src/components/LiteChat/prompt/PromptWrapper.tsx

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, Loader2 } from "lucide-react";
import { PromptControlWrapper } from "./PromptControlWrapper";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
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
import { FilePreviewRenderer } from "../common/FilePreviewRenderer";

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
  inputAreaRef,
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
  const { attachedFilesMetadata, clearAttachedFiles, removeAttachedFile } =
    useInputStore(
      useShallow((state) => ({
        attachedFilesMetadata: state.attachedFilesMetadata,
        clearAttachedFiles: state.clearAttachedFiles,
        removeAttachedFile: state.removeAttachedFile,
      })),
    );

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
    inputAreaRef,
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
    <div className={cn("p-2 md:p-4 space-y-2 md:space-y-3", className)}>
      {panelControls.length > 0 && (
        <PromptControlWrapper
          controls={panelControls}
          area="panel"
          className="flex flex-wrap gap-1 md:gap-2 items-start mb-1 md:mb-2" // Adjusted gap/margin
        />
      )}

      {/* Attached Files Preview Area */}
      {attachedFilesMetadata.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2 bg-muted/20 mb-2">
          {attachedFilesMetadata.map((fileMeta) => (
            <FilePreviewRenderer
              key={fileMeta.id}
              fileMeta={fileMeta}
              onRemove={removeAttachedFile} // Pass remove function
              isReadOnly={false}
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <InputAreaRenderer
          // Pass the ref down to the actual InputArea component
          ref={inputAreaRef}
          onSubmit={handleSubmit}
          disabled={isStreaming || isSubmitting}
          placeholder={placeholder}
          onValueChange={handleInputValueChange}
          className="flex-grow" // Allow textarea to grow
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={
            isStreaming ||
            isSubmitting ||
            (!hasInputValue && attachedFilesMetadata.length === 0)
          }
          className="h-9 w-9 flex-shrink-0" // Consistent size
          aria-label="Send message"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonalIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      <PromptControlWrapper
        controls={triggerControls}
        area="trigger"
        className="flex items-center gap-1 flex-wrap flex-shrink-0 mt-1 md:mt-2" // Allow wrapping, adjusted margin
      />
    </div>
  );
};
