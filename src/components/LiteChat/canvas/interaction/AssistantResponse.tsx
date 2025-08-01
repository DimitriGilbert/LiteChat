// src/components/LiteChat/canvas/interaction/AssistantResponse.tsx
// FULL FILE
import React, { useState, useCallback, useMemo } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  BrainCircuitIcon,
  ClipboardIcon,
  CheckIcon,
} from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import {
  useMarkdownParser,
} from "@/lib/litechat/useMarkdownParser";
import { UniversalBlockRenderer } from "@/components/LiteChat/common/UniversalBlockRenderer";
import { SelectionDetector } from "@/components/LiteChat/canvas/SelectionDetector";
import { type ToolCallPart, type ToolResultPart } from "ai";
import { toast } from "sonner";
import { useControlRegistryStore } from "@/store/control.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl, CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { useTranslation } from "react-i18next";
import { ImageBlockRenderer } from "@/components/LiteChat/common/ImageBlockRenderer";

const StaticContentView: React.FC<{ markdownContent: string | null, interactionId: string }> = ({
  markdownContent,
  interactionId
}) => {
  const parsedContent = useMarkdownParser(markdownContent);

  if (!markdownContent?.trim()) {
    return null;
  }

  return (
    <SelectionDetector 
      interactionId={interactionId} 
      responseContent={markdownContent}
    >
      <div className="overflow-wrap-anywhere">
        {parsedContent.map((item, index) => {
          if (typeof item === "string") {
            // Check if this HTML contains generated images (base64 data URLs)
            const imgRegex = /<img([^>]*src="data:image\/[^"]*"[^>]*)>/gi;
            const imgMatches = Array.from(item.matchAll(imgRegex));
            
            if (imgMatches.length > 0) {
              // Process each image and replace with ImageBlockRenderer
              let processedContent = item;
              const imageComponents: React.ReactNode[] = [];
              
              imgMatches.forEach((match, imgIndex) => {
                const imgTag = match[0];
                const imgAttributes = match[1];
                
                // Extract src and alt attributes
                const srcMatch = imgAttributes.match(/src="([^"]*)"/);
                const altMatch = imgAttributes.match(/alt="([^"]*)"/);
                
                const src = srcMatch?.[1] || '';
                const alt = altMatch?.[1] || 'Generated Image';
                
                // Create a placeholder to replace with React component
                const placeholder = `__IMAGE_COMPONENT_${imgIndex}__`;
                processedContent = processedContent.replace(imgTag, placeholder);
                
                imageComponents.push(
                  <ImageBlockRenderer
                    key={`image-${index}-${imgIndex}`}
                    src={src}
                    alt={alt}
                  />
                );
              });
              
              // Split by placeholders and intersperse with image components
              const parts = processedContent.split(/__IMAGE_COMPONENT_(\d+)__/);
              const renderedParts: React.ReactNode[] = [];
              
              for (let i = 0; i < parts.length; i++) {
                if (parts[i] && parts[i].trim()) {
                  // Check if this is an image index
                  const imageIndex = parseInt(parts[i]);
                  if (!isNaN(imageIndex) && imageComponents[imageIndex]) {
                    renderedParts.push(imageComponents[imageIndex]);
                  } else {
                    // Regular HTML content
                    renderedParts.push(
                      <div
                        key={`html-${index}-${i}`}
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: parts[i] }}
                      />
                    );
                  }
                }
              }
              
              return <div key={`content-${index}`}>{renderedParts}</div>;
            }
            
            // No images, render normally
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
                interactionId={interactionId}
              />
            );
          }
          return null;
        })}
      </div>
    </SelectionDetector>
  );
};

interface AssistantResponseProps {
  interactionId: string;
  response: any | null;
  toolCalls: string[] | undefined;
  toolResults: string[] | undefined;
  reasoning: string | undefined;
  isError: boolean;
  errorMessage: string | undefined;
  isFolded: boolean;
  toggleFold: () => void;
}

export const AssistantResponse: React.FC<AssistantResponseProps> = ({
  interactionId,
  response,
  toolCalls: toolCallStrings,
  toolResults: toolResultStrings,
  reasoning,
  isError,
  errorMessage,
  isFolded,
  toggleFold,
}) => {
  const [isReasoningFolded, setIsReasoningFolded] = useState(true);
  const [isReasoningCopied, setIsReasoningCopied] = useState(false);

  const { t } = useTranslation('canvas');

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

  const parsedToolSteps = useMemo(() => {
    if (!toolCallStrings) return [];
    const calls = toolCallStrings.map(str => JSON.parse(str) as ToolCallPart);
    const results = toolResultStrings?.map(str => JSON.parse(str) as ToolResultPart) ?? [];
    
    return calls.map(call => {
      const result = results.find(res => res.toolCallId === call.toolCallId);
      return { call, result };
    });
  }, [toolCallStrings, toolResultStrings]);

  const toggleReasoningFold = useCallback(
    () => setIsReasoningFolded((prev) => !prev),
    [],
  );

  const handleCopyReasoning = useCallback(async () => {
    if (!reasoning) return;
    try {
      await navigator.clipboard.writeText(reasoning);
      setIsReasoningCopied(true);
      toast.success(t('reasoningCopiedSuccess'));
      setTimeout(() => setIsReasoningCopied(false), 1500);
    } catch (err) {
      toast.error(t('failedToCopyReasoning'));
      console.error("Clipboard copy failed for reasoning:", err);
    }
  }, [reasoning, t]);

  const hasReasoning = !!reasoning;
  const hasResponseContent =
    response && (typeof response !== "string" || response.trim().length > 0);
  const hasToolCalls = parsedToolSteps && parsedToolSteps.length > 0;
  
  // Debug logging for image generation
  if (typeof response === "string" && response.includes("![Generated Image]")) {
    console.log("[AssistantResponse] Image response detected:", response.substring(0, 100));
    console.log("[AssistantResponse] hasResponseContent:", hasResponseContent);
  }

  if (isFolded) {
    return (
      <div
        className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
        onClick={toggleFold}
      >
        {hasReasoning ? t('reasoningPrefix') : ""}
        {hasToolCalls ? `${parsedToolSteps?.length} ${t('toolCallsPrefix')}` : ""}
        {hasResponseContent && typeof response === "string"
          ? `"${response.substring(0, 80)}${response.length > 80 ? "..." : ""}"`
          : hasToolCalls || hasReasoning
            ? ""
            : t('noTextResponse')}
      </div>
    );
  }

  return (
    <>
      {isError && errorMessage && (
        <div className="mb-2 rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive-foreground">
          <p className="font-semibold">{t('errorLabel')}</p>
          <p>{errorMessage}</p>
        </div>
      )}
      {hasReasoning && (
        <div className="my-2 p-2 border border-blue-500/30 bg-blue-500/10 rounded-md text-xs">
          <div
            className="flex items-center justify-between mb-1 cursor-pointer group/reasoning"
            onClick={toggleReasoningFold}
          >
            <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <BrainCircuitIcon className="h-3.5 w-3.5" /> {t('reasoningSectionTitle')}
            </span>
            <div className="flex items-center opacity-0 group-hover/reasoning:opacity-100 focus-within:opacity-100 transition-opacity">
              <ActionTooltipButton
                tooltipText={t('copyReasoning')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyReasoning();
                }}
                aria-label={t('copyReasoning')}
                icon={
                  isReasoningCopied ? (
                    <CheckIcon className="text-green-500" />
                  ) : (
                    <ClipboardIcon />
                  )
                }
                className="h-5 w-5 text-muted-foreground"
              />
              <ActionTooltipButton
                tooltipText={
                  isReasoningFolded ? "Show Reasoning" : "Hide Reasoning"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  toggleReasoningFold();
                }}
                aria-label={
                  isReasoningFolded ? "Show reasoning" : "Hide reasoning"
                }
                icon={
                  isReasoningFolded ? <ChevronDownIcon /> : <ChevronUpIcon />
                }
                iconClassName="h-3 w-3"
                className="h-5 w-5 text-muted-foreground"
              />
            </div>
          </div>
          {!isReasoningFolded && (
            <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-background/30 rounded mt-1 overflow-wrap-anywhere">
              {reasoning!}
            </pre>
          )}
        </div>
      )}
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
      {hasResponseContent && typeof response === "string" && (
        <StaticContentView markdownContent={response} interactionId={interactionId} />
      )}
      {!hasResponseContent && !hasToolCalls && !hasReasoning && !isError && (
         <div className="text-xs text-muted-foreground italic p-1">
           [No text response]
         </div>
      )}
    </>
  );
};
