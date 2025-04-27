// src/components/LiteChat/common/CodeBlockRenderer.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Prism from "prismjs";
// Import only needed Prism language components to minimize bundle size
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

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckIcon, ClipboardIcon, ChevronsUpDownIcon } from "lucide-react"; // Add ChevronsUpDownIcon
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components
import { toast } from "sonner";

interface CodeBlockRendererProps {
  lang: string | undefined;
  code: string;
}

export const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = ({
  lang,
  code,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isFolded, setIsFolded] = useState(false); // State for folding
  const codeRef = useRef<HTMLElement>(null);

  const highlightCode = useCallback(() => {
    if (codeRef.current && code) {
      try {
        // Ensure the content is set before highlighting
        codeRef.current.textContent = code;
        Prism.highlightElement(codeRef.current);
      } catch (error) {
        console.error("Prism highlight error:", error);
        // Fallback to raw code if highlighting fails
        codeRef.current.textContent = code;
      }
    } else if (codeRef.current) {
      // Clear content if there's no code
      codeRef.current.textContent = "";
    }
  }, [code]); // Depend only on code

  // Highlight on initial render and when code/lang changes, but only if not folded
  useEffect(() => {
    if (!isFolded) {
      highlightCode();
    }
  }, [code, lang, isFolded, highlightCode]); // Add highlightCode dependency

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      toast.success("Code copied to clipboard!");
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy code.");
      console.error("Clipboard copy failed:", err);
    }
  };

  const toggleFold = () => {
    const unfolding = isFolded; // Check the state *before* toggling
    setIsFolded((prev) => !prev);
    if (unfolding) {
      // If we were folded and are now unfolding, trigger highlight after state update
      // Use setTimeout to ensure DOM update happens first
      setTimeout(highlightCode, 0);
    }
  };

  const languageClass = lang ? `language-${lang}` : "language-plaintext";

  // Get first few lines for folded preview
  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code.split("\n").slice(0, 3).join("\n");
  }, [code]);

  return (
    <div className="code-block-container my-4">
      <div className="code-block-header">
        <span className="text-xs text-muted-foreground">{lang || "code"}</span>
        <div className="flex items-center gap-0.5">
          {/* Fold/Unfold Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold code" : "Fold code"}
                >
                  <ChevronsUpDownIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFolded ? "Unfold" : "Fold"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Copy Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  aria-label="Copy code"
                >
                  {isCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {/* Use standard pre > code structure for Prism */}
      {/* Conditionally render the code block content */}
      {!isFolded && (
        <pre className={cn("code-block-content")}>
          <code ref={codeRef} className={cn(languageClass)}>
            {/* Render code initially for Prism, highlightCode will overwrite */}
            {code}
          </code>
        </pre>
      )}
      {/* Folded Preview */}
      {isFolded && (
        <div
          className="folded-content-preview p-4 pt-0" // Add padding consistent with code block
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
