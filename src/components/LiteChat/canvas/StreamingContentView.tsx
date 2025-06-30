// src/components/LiteChat/canvas/StreamingContentView.tsx
// FULL FILE
import React, {useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  useMarkdownParser,
  UniversalBlockData,
  ParsedContent,
} from "@/lib/litechat/useMarkdownParser";
import { UniversalBlockRenderer } from "@/components/LiteChat/common/UniversalBlockRenderer";
import { useSettingsStore } from "@/store/settings.store";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { type ToolCallPart, type ToolResultPart } from "ai";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControl, CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { useInteractionStore } from "@/store/interaction.store";
import MarkdownIt from "markdown-it";

interface StreamingContentViewProps {
  interactionId: string;
  markdownContent: string | null | undefined;
  isStreaming?: boolean;
  className?: string;
}

// Helper to render a single parsed block using UniversalBlockRenderer
const renderBlock = (
  item: string | UniversalBlockData,
  index: number,
  isStreamingBlock: boolean,
  interactionId: string
): React.ReactNode | null => {
  if (typeof item === "string") {
    if (!item.trim()) return null;
    return (
      <div
        key={`html-${index}`}
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: item }}
      />
    );
  } else if (item.type === "block") {
    // Always use UniversalBlockRenderer for all code blocks
    return (
      <UniversalBlockRenderer
        key={`block-${index}`}
        lang={item.lang}
        code={item.code}
        filepath={item.filepath}
        isStreaming={isStreamingBlock}
        interactionId={interactionId}
      />
    );
  }
  return null;
};

export const StreamingContentView: React.FC<StreamingContentViewProps> = ({
  interactionId,
  markdownContent,
  isStreaming = false,
  className,
}) => {
  const { t } = useTranslation('canvas');
  const { enableStreamingMarkdown } =
    useSettingsStore(
      useShallow((state) => ({
        enableStreamingMarkdown: state.enableStreamingMarkdown,
      }))
    );

  const parsedContent: ParsedContent = useMarkdownParser(
    enableStreamingMarkdown ? markdownContent : null
  );

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForToolCallStep = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      context: CanvasControlRenderContext
    ): React.ReactNode[] => {
      return canvasControls
        .filter(
          (c) =>
            c.type === "tool-call-step" &&
            c.targetSlot === targetSlotName &&
            c.renderer
        )
        .map((control) => {
          if (control.renderer) {
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean) as React.ReactNode[];
    },
    [canvasControls]
  );

  const { toolCallStrings, toolResultStrings } = useInteractionStore(
    useShallow((state) => {
      const interaction = state.interactions.find(i => i.id === interactionId);
      return {
        toolCallStrings: interaction?.metadata?.toolCalls,
        toolResultStrings: interaction?.metadata?.toolResults,
      };
    })
  );

  const parsedToolSteps = useMemo(() => {
    if (!toolCallStrings) return [];
    try {
      const calls = toolCallStrings.map(str => JSON.parse(str) as ToolCallPart);
      const results = toolResultStrings?.map(str => JSON.parse(str) as ToolResultPart) ?? [];
      return calls.map(call => {
        const result = results.find(res => res.toolCallId === call.toolCallId);
        return { call, result };
      });
    } catch (e) {
      console.error("[StreamingContentView] Error parsing tool call/result strings:", e);
      return [];
    }
  }, [toolCallStrings, toolResultStrings]);

  const renderedMarkdownElements = useMemo(() => {
    if (!enableStreamingMarkdown) return [];
    return parsedContent.map((item, index) => renderBlock(
      item,
      index,
      isStreaming && index === parsedContent.length - 1,
      interactionId
    )).filter(Boolean);
  }, [enableStreamingMarkdown, parsedContent, isStreaming, interactionId]);

  if (!enableStreamingMarkdown && !markdownContent && parsedToolSteps.length === 0) {
      return isStreaming ? <div className={cn("text-muted-foreground italic", className)}>{t('generatingResponse')}</div> : null;
  }

  return (
    <div className={cn("streaming-content-view overflow-wrap-anywhere", className)}>
      {/* Render Tool Calls First */}
      {parsedToolSteps.map(({ call, result }, idx) => {
        const toolCallContext: CanvasControlRenderContext = {
          interactionId,
          toolCall: call,
          toolResult: result,
          canvasContextType: "tool-call-step",
        };
        return (
          <React.Fragment key={`tool-step-${call.toolCallId || idx}`}>
            {renderSlotForToolCallStep("tool-call-content", toolCallContext)}
          </React.Fragment>
        );
      })}

      {/* Render markdown/code blocks */}
      {enableStreamingMarkdown 
        ? renderedMarkdownElements 
        : markdownContent 
          ? <div className="markdown-content" dangerouslySetInnerHTML={{ __html: new MarkdownIt().render(markdownContent) }} />
          : null
      }
    </div>
  );
};
