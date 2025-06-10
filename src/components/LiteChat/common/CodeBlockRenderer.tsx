// src/components/LiteChat/common/CodeBlockRenderer.tsx
// FULL FILE
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-go";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";

import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control"; // For renderSlot type
import { useControlRegistryStore } from "@/store/control.store"; // To get canvas controls
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";

interface CodeBlockRendererProps {
  lang: string | undefined;
  code: string;
  filepath?: string;
  isStreaming?: boolean;
}

const CodeBlockRendererComponent: React.FC<CodeBlockRendererProps> = ({
  lang,
  code,
  filepath,
  isStreaming = false,
}) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const codeRef = useRef<HTMLElement>(null);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      currentLang?: string,
      currentFilepath?: string,
      currentIsFolded?: boolean,
      currentToggleFold?: () => void
    ): React.ReactNode[] => {
      return canvasControls
        .filter(
          (c) =>
            c.type === "codeblock" &&
            c.targetSlot === targetSlotName &&
            c.renderer
        )
        .map((control) => {
          if (control.renderer) {
            const context: CanvasControlRenderContext = {
              codeBlockContent: currentCode,
              codeBlockLang: currentLang,
              codeBlockFilepath: currentFilepath,
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
            };
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean);
    },
    [canvasControls]
  );

  const highlightCode = useCallback(() => {
    if (codeRef.current && code) {
      try {
        if (codeRef.current.style.whiteSpace !== "pre-wrap") {
          codeRef.current.style.whiteSpace = "pre-wrap";
        }
        codeRef.current.textContent = code;
        Prism.highlightElement(codeRef.current);
      } catch (error) {
        console.error("Prism highlight error:", error);
        codeRef.current.textContent = code;
      }
    } else if (codeRef.current) {
      codeRef.current.textContent = "";
    }
  }, [code]);

  useEffect(() => {
    if (!isFolded) {
      highlightCode();
    }
  }, [code, lang, isFolded, highlightCode]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding) {
      setTimeout(highlightCode, 0);
    }
  };

  const languageClass = lang ? `language-${lang}` : "language-plaintext";

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code
      .split(
        `
`
      )
      .slice(0, 3).join(`
`);
  }, [code]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    code,
    lang,
    filepath,
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">
            {lang ? lang.toUpperCase() : "CODE"}
          </div>
          {filepath && (
            <div className="text-xs text-muted-foreground font-mono">
              {filepath}
            </div>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div></div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere">
            <code ref={codeRef} className={languageClass + " block"}></code>
          </pre>
        </div>
      )}
      {isFolded && (
        <div
          className="folded-content-preview p-4 cursor-pointer w-full box-border"
          onClick={toggleFold}
        >
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm">
            {foldedPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
};

export const CodeBlockRenderer = memo(CodeBlockRendererComponent);
