// src/components/LiteChat/common/CodeBlockRenderer.tsx
import React, { useState, useEffect, useRef } from "react";
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
import { CheckIcon, ClipboardIcon } from "lucide-react";
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
  const codeRef = useRef<HTMLElement>(null);

  // Highlight the code block whenever the code or language changes
  useEffect(() => {
    if (codeRef.current && code) {
      try {
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
  }, [code, lang]);

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

  const languageClass = lang ? `language-${lang}` : "language-plaintext";

  return (
    <div className="code-block-container my-4">
      <div className="code-block-header">
        <span className="text-xs text-muted-foreground">{lang || "code"}</span>
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
      </div>
      {/* Use standard pre > code structure for Prism */}
      <pre className="code-block-content">
        <code ref={codeRef} className={cn(languageClass)}>
          {code}
        </code>
      </pre>
    </div>
  );
};
