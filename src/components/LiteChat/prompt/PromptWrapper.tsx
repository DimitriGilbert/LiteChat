// src/components/LiteChat/prompt/PromptWrapper.tsx
// FULL FILE
import React, { useState, useCallback, useMemo, useEffect } from "react";
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
import { runMiddleware } from "@/lib/litechat/ai-helpers"; // Corrected: Ensure this is exported
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { ModMiddlewareHook } from "@/types/litechat/modding";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { SidebarItemType } from "@/types/litechat/chat";
import { usePromptStateStore } from "@/store/prompt.store";
import { useTranslation } from "react-i18next";

interface PromptWrapperProps {
  InputAreaRenderer: InputAreaRenderer;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
  placeholder?: string;
  inputAreaRef: React.RefObject<InputAreaRef | null>;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
  placeholder,
  inputAreaRef,
  selectedItemId,
  selectedItemType,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInputValue, setHasInputValue] = useState(false);
  const { t } = useTranslation('prompt');

  const registeredPromptControls = useControlRegistryStore(
    useShallow((state) => state.promptControls)
  );
  const isStreaming = useInteractionStore(
    useShallow((state) => state.status === "streaming")
  );
  const { attachedFilesMetadata, clearAttachedFiles } = useInputStore(
    useShallow((state) => ({
      attachedFilesMetadata: state.attachedFilesMetadata,
      clearAttachedFiles: state.clearAttachedFiles,
    }))
  );
  const currentModelIdFromPromptStore = usePromptStateStore(
    (state) => state.modelId
  );

  const promptControls = useMemo(() => {
    return Object.values(registeredPromptControls);
  }, [registeredPromptControls]);

  const panelControls = useMemo(
    () => promptControls.filter((c) => c.renderer),
    [promptControls]
  );
  const triggerControls = useMemo(
    () => promptControls.filter((c) => c.triggerRenderer),
    [promptControls]
  );

  const handleSubmit = useCallback(async (overrideContent?: string) => {
    const valueFromRef = inputAreaRef?.current?.getValue() ?? "";
    const trimmedValue = overrideContent !== undefined ? overrideContent.trim() : valueFromRef.trim();
    const currentAttachedFiles = useInputStore.getState().attachedFilesMetadata;

    if (!trimmedValue && currentAttachedFiles.length === 0) {
      return;
    }
    if (isStreaming || isSubmitting) return;

    // Check if a model is selected before proceeding
    if (!currentModelIdFromPromptStore) {
      toast.error("Please select a model before sending a message");
      return;
    }

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

      if (!metadata.modelId && currentModelIdFromPromptStore) {
        metadata.modelId = currentModelIdFromPromptStore;
      }

      let turnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedValue,
        parameters,
        metadata,
      };

      emitter.emit(promptEvent.submitted, { turnData });

      const middlewareResult = await runMiddleware(
        ModMiddlewareHook.PROMPT_TURN_FINALIZE,
        { turnData }
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
      inputAreaRef.current?.clearValue();
      setHasInputValue(false);
    } catch (error) {
      console.error("Error during prompt submission:", error);
      toast.error(
        `Failed to send message: ${
          error instanceof Error ? error.message : String(error)
        }`
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
    currentModelIdFromPromptStore,
  ]);

  useEffect(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      requestAnimationFrame(() => {
        inputAreaRef.current?.focus();
      });
    }
  }, [selectedItemId, selectedItemType, inputAreaRef]);

  useEffect(() => {
    const handleFocusRequest = () => {
      requestAnimationFrame(() => {
        inputAreaRef.current?.focus();
      });
    };

    const handleSetInputTextRequest = (payload: { text: string }) => {
      if (inputAreaRef.current) {
        inputAreaRef.current.setValue(payload.text);
        setHasInputValue(payload.text.trim().length > 0);
      }
    };

    const handleSubmitRequest = async (payload: { turnData: PromptTurnObject }) => {
      const currentInteractionState = useInteractionStore.getState();
      if (currentInteractionState.status === "streaming" || isSubmitting) return;

      await handleSubmit(payload.turnData.content);
    };

    emitter.on(promptEvent.focusInputRequest, handleFocusRequest);
    emitter.on(promptEvent.setInputTextRequest, handleSetInputTextRequest);
    emitter.on(promptEvent.submitPromptRequest, handleSubmitRequest);

    return () => {
      emitter.off(promptEvent.focusInputRequest, handleFocusRequest);
      emitter.off(promptEvent.setInputTextRequest, handleSetInputTextRequest);
      emitter.off(promptEvent.submitPromptRequest, handleSubmitRequest);
    };
  }, [handleSubmit, isSubmitting]);

  const handleInputValueChange = useCallback((value: string) => {
    setHasInputValue(value.trim().length > 0);
  }, []);

  const translatedPlaceholder = t('sendMessagePlaceholder');

  return (
    <div className={cn("p-2 md:p-4 space-y-2 md:space-y-3", className)}>
      {panelControls.length > 0 && (
        <PromptControlWrapper
          controls={panelControls}
          area="panel"
          className="flex flex-wrap gap-1 md:gap-2 items-start mb-1 md:mb-2"
        />
      )}
      <div className="flex items-end gap-2">
        <InputAreaRenderer
          ref={inputAreaRef}
          onSubmit={handleSubmit}
          placeholder={placeholder || translatedPlaceholder}
          onValueChange={handleInputValueChange}
          disabled={isStreaming || isSubmitting}
          className="flex-grow"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => handleSubmit(undefined)}
          disabled={
            isStreaming ||
            isSubmitting ||
            (!hasInputValue && attachedFilesMetadata.length === 0) ||
            !currentModelIdFromPromptStore
          }
          className="h-9 w-9 flex-shrink-0"
          aria-label={t('sendMessage')}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonalIcon className="h-4 w-4" />
          )}
        </Button>
      </div>{" "}
      <PromptControlWrapper
        controls={triggerControls}
        area="trigger"
        className="flex items-center gap-1 flex-wrap flex-shrink-0 mt-1 md:mt-2"
      />
    </div>
  );
};
