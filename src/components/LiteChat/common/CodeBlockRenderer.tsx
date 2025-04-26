// src/components/LiteChat/common/CodeBlockRenderer.tsx
import React, { useState, useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core"; // Import core hljs
// Import specific languages needed to reduce bundle size
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import html from "highlight.js/lib/languages/xml"; // html is often under xml
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import yaml from "highlight.js/lib/languages/yaml";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
// Add other languages as needed

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckIcon, ClipboardIcon } from "lucide-react"; // Removed Loader2
import { toast } from "sonner";

// Register the imported languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", html);
hljs.registerLanguage("xml", html); // Alias xml to html
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("go", go);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);

interface CodeBlockRendererProps {
  lang: string | undefined;
  code: string;
}

export const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = ({
  lang,
  code,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null); // Ref for the <code> element

  // Highlight the code block when component mounts or code/lang changes
  useEffect(() => {
    if (codeRef.current && code) {
      try {
        hljs.highlightElement(codeRef.current);
      } catch (error) {
        console.error("Highlight.js error:", error);
        // Fallback: display raw code if highlighting fails
        codeRef.current.textContent = code;
      }
    } else if (codeRef.current) {
      // Clear content if code is empty
      codeRef.current.textContent = "";
    }
  }, [code, lang]); // Re-run effect if code or lang changes

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

  // Determine the language class for hljs
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
      {/* Use standard pre > code structure for hljs */}
      {/* The themes in index.css target `.hljs` */}
      <pre className="code-block-content hljs">
        <code ref={codeRef} className={cn(languageClass, "hljs")}>
          {/* Render raw code initially, useEffect will highlight it */}
          {code}
        </code>
      </pre>
    </div>
  );
};
