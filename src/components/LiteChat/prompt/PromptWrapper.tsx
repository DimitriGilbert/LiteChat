// src/components/LiteChat/prompt/PromptWrapper.tsx
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import type {
  PromptTurnObject,
  InputAreaRendererProps,
} from "@/types/litechat/prompt";
import type { InputAreaRef } from "./InputArea";
import { PromptControlWrapper } from "./PromptControlWrapper";
import { Button } from "@/components/ui/button";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store"; // Import Provider store
import { SendHorizonalIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/types/litechat/modding";
import { cn } from "@/lib/utils";
import { useInputStore, type AttachedFileMetadata } from "@/store/input.store";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";

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
  InputAreaRenderer: React.ForwardRefExoticComponent<
    Omit<InputAreaRendererProps, "value" | "onChange"> &
      React.RefAttributes<InputAreaRef>
  >;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
}) => {
  const inputAreaRef = useRef<InputAreaRef>(null);
  const { attachedFilesMetadata, clearAttachedFiles, removeAttachedFile } =
    useInputStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registeredControls = useControlRegistryStore(
    (state) => state.promptControls,
  );
  const isStreaming = useInteractionStore(
    (state) => state.status === "streaming",
  );
  // Removed selectGlobalModel import

  const activeControls = useMemo(
    () =>
      Object.values(registeredControls)
        .filter((c) => (c.show ? c.show() : true))
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [registeredControls],
  );

  const handleClearInputs = useCallback(() => {
    clearAttachedFiles();
    activeControls.forEach((c) => {
      if (c.clearOnSubmit) c.clearOnSubmit();
    });
    // Reset input area via ref if necessary (InputArea might handle this internally)
    // inputAreaRef.current?.reset(); // Assuming InputArea has a reset method
  }, [activeControls, clearAttachedFiles]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const currentInputValue = inputAreaRef.current?.getValue() ?? "";
      const trimmedInput = currentInputValue.trim();

      if (isStreaming) {
        console.warn("Submit prevented: AI is currently streaming.");
        return;
      }

      const currentAttachedFilesMetadata =
        useInputStore.getState().attachedFilesMetadata;
      const hasContent =
        trimmedInput || currentAttachedFilesMetadata.length > 0;

      if (!hasContent) {
        console.warn("Submit prevented: No content provided.");
        return;
      }

      setIsSubmitting(true);

      const fileMetadataForTurn: AttachedFileMetadata[] = JSON.parse(
        JSON.stringify(currentAttachedFilesMetadata),
      );

      let collectedTurnData: PromptTurnObject = {
        id: nanoid(),
        content: trimmedInput,
        parameters: {},
        metadata: {
          attachedFiles: fileMetadataForTurn,
        },
      };

      // --- Collect parameters and metadata from controls ---
      // Variable to store model ID from control removed
      for (const control of activeControls) {
        if (control.getParameters) {
          try {
            const p = await control.getParameters();
            if (p && typeof p === "object") {
              collectedTurnData.parameters = {
                ...collectedTurnData.parameters,
                ...p,
              };
            }
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
            if (m && typeof m === "object") {
              const { attachedFiles: controlFiles, ...otherMeta } = m;
              if (controlFiles) {
                console.warn(
                  `Control ${control.id} tried to overwrite attachedFiles metadata. Ignoring.`,
                );
              }
              // Metadata is now directly merged. The model selector control's
              // getMetadata will read the current global state.
              collectedTurnData.metadata = {
                ...collectedTurnData.metadata,
                ...otherMeta,
                attachedFiles: collectedTurnData.metadata.attachedFiles,
              };
            }
          } catch (err) {
            console.error(
              `Error getting metadata from control ${control.id}:`,
              err,
            );
          }
        }
      }
      // --- End Control Data Collection ---

      // --- Update Global Model Selection REMOVED ---
      // The global model selection is now updated directly by the
      // GlobalModelSelector component via its onChange prop.

      // Ensure the final metadata reflects the current global selection
      // This might be redundant if getMetadata already reads it, but ensures consistency.
      collectedTurnData.metadata.modelId =
        useProviderStore.getState().selectedModelId;
      if (!collectedTurnData.metadata.modelId) {
        toast.error("No model selected. Please choose a model.");
        setIsSubmitting(false);
        return; // Prevent submission if no model is selected
      }
      // --- End Update Global Model Selection ---

      emitter.emit("prompt:submitted", { turnData: collectedTurnData });

      const middlewareResult = await runMiddleware(
        "middleware:prompt:turnFinalize",
        { turnData: collectedTurnData },
      );

      if (middlewareResult === false) {
        console.log("Submission cancelled by middleware:prompt:turnFinalize.");
        setIsSubmitting(false);
        return;
      }

      const finalTurnData =
        middlewareResult && typeof middlewareResult === "object"
          ? (middlewareResult as { turnData: PromptTurnObject }).turnData
          : collectedTurnData;

      try {
        await onSubmit(finalTurnData);
        handleClearInputs();
      } catch (err) {
        console.error("Error during final prompt submission:", err);
        toast.error(
          `Submission failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, isStreaming, handleClearInputs, activeControls], // Removed selectGlobalModel dependency
  );

  const handleInputSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const hasPanelControls = activeControls.some((c) => !!c.renderer);
  const hasTriggerControls = activeControls.some((c) => !!c.triggerRenderer);

  useEffect(() => {
    return () => {
      clearAttachedFiles();
    };
  }, [clearAttachedFiles]);

  const isSubmitDisabled =
    isSubmitting ||
    isStreaming ||
    // Basic check: disable if no files attached (input check is harder here)
    attachedFilesMetadata.length === 0;

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

      {attachedFilesMetadata.length > 0 && (
        <div className="px-3 md:px-4 pt-2 border-b border-border/50 max-h-24 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 pb-1.5">
            {attachedFilesMetadata.map((fileMeta) => (
              <Badge
                key={fileMeta.id}
                variant="secondary"
                className="flex items-center gap-1.5 pl-1.5 pr-0.5 py-0.5 text-xs"
              >
                <span className="truncate max-w-[150px]" title={fileMeta.name}>
                  {fileMeta.name}
                </span>
                <span className="text-muted-foreground/80">
                  ({formatBytes(fileMeta.size)})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeAttachedFile(fileMeta.id)}
                  aria-label={`Remove ${fileMeta.name}`}
                  disabled={isSubmitting || isStreaming}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 md:p-4 flex items-end gap-2">
        <div className="flex-grow">
          <InputAreaRenderer
            ref={inputAreaRef}
            onSubmit={handleInputSubmit}
            disabled={isSubmitting || isStreaming}
            initialValue=""
          />
        </div>

        <div className="flex-shrink-0">
          <Button
            type="submit"
            // A more robust check might involve getting the input value via ref here,
            // but that could be complex. Relying on InputArea's internal Enter key handling
            // and this basic check might be sufficient for now.
            disabled={isSubmitDisabled}
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Send message"
          >
            <SendHorizonalIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {hasTriggerControls && (
        <div className="px-3 md:px-4 pb-2 pt-1 flex-grow">
          <PromptControlWrapper
            controls={activeControls}
            area="trigger"
            className="flex flex-wrap items-center gap-1 [&>*]:flex-shrink-0"
          />
        </div>
      )}
    </form>
  );
};
