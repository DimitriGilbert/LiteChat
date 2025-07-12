// src/components/LiteChat/canvas/SelectionDetector.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useControlRegistryStore } from "@/store/control.store";
import type { SelectionControlContext } from "@/types/litechat/canvas/control";

interface SelectionDetectorProps {
  children: React.ReactNode;
  interactionId?: string;
  responseContent?: string;
}

export const SelectionDetector: React.FC<SelectionDetectorProps> = ({
  children,
  interactionId,
  responseContent,
}) => {
  const [selectionContext, setSelectionContext] = useState<SelectionControlContext | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectionControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.selectionControls))
  );

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !containerRef.current) {
      setSelectionContext(null);
      setSelectionPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText || selectedText.length === 0) {
      setSelectionContext(null);
      setSelectionPosition(null);
      return;
    }

    // Check if selection is within our container
    const containerElement = containerRef.current;
    if (!containerElement.contains(range.commonAncestorContainer)) {
      setSelectionContext(null);
      setSelectionPosition(null);
      return;
    }

    const selectionBounds = range.getBoundingClientRect();
    const containerBounds = containerElement.getBoundingClientRect();

    setSelectionContext({
      selectedText,
      selectionBounds,
      interactionId,
      responseContent,
    });

    // Position controls relative to container
    setSelectionPosition({
      x: selectionBounds.right - containerBounds.left + 8,
      y: selectionBounds.bottom - containerBounds.top + 8,
    });
  }, [interactionId, responseContent]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const handleContainerClick = useCallback((_e: React.MouseEvent) => {
    // Clear selection if clicking outside selected text
    const selection = window.getSelection();
    if (selection && !selection.toString()) {
      setSelectionContext(null);
      setSelectionPosition(null);
    }
  }, []);

  return (
    <div ref={containerRef} onClick={handleContainerClick} className="relative">
      {children}
      {selectionContext && selectionPosition && (
        <div
          className="absolute z-50 flex gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg"
          style={{
            left: selectionPosition.x,
            top: selectionPosition.y,
          }}
        >
          {selectionControls.map((control) => {
            // Check show condition if provided
            if (control.showCondition && !control.showCondition(selectionContext)) {
              return null;
            }

            return (
              <div key={control.id}>
                {control.renderer(selectionContext)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};