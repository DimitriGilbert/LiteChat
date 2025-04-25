import React, { useState, useCallback, useMemo } from "react";
import type {
  InputAreaRenderer,
  PromptControl,
  PromptTurnObject,
} from "@/types/litechat/prompt"; // Use PromptTurnObject
import { PromptControlWrapper } from "./PromptControlWrapper";
import { Button } from "@/components/ui/button";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { SendHorizonalIcon } from "lucide-react";
import { nanoid } from "nanoid"; // Import nanoid

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
      // Allow submission even if input is empty, if controls provide content/metadata
      if (isStreaming) return;
      setIsSubmitting(true);

      // Base PromptTurnObject
      let turnData: PromptTurnObject = {
        id: nanoid(), // ID for this specific turn's data
        content: trimmedInput, // Content from input area
        parameters: {},
        metadata: {},
      };

      // 1. Collect parameters and metadata from controls
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

      // Check if there's any content (input or from metadata like files)
      // This check might need refinement based on how controls add content metadata
      const hasContent =
        trimmedInput ||
        Object.keys(turnData.metadata).some((key) =>
          key.startsWith("fileRef:"),
        ); // Example check
      if (!hasContent) {
        console.log(
          "PromptWrapper: Submission prevented - no text input and no apparent content from controls.",
        );
        setIsSubmitting(false);
        return; // Prevent submission if truly empty
      }

      // 2. Apply PROMPT_TURN_FINALIZE middleware
      for (const control of activeControls) {
        if (control.middleware) {
          // Assuming middleware modifies PromptTurnObject now
          try {
            const result = await control.middleware(turnData);
            if (typeof result === "object" && result !== null)
              turnData = result;
            else
              console.warn(
                `Middleware from ${control.id} returned invalid type.`,
              );
          } catch (error) {
            console.error(`Middleware error in ${control.id}:`, error);
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 3. Call the final onSubmit prop with the processed turn data
      try {
        await onSubmit(turnData);
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
