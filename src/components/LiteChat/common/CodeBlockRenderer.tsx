// src/components/LiteChat/common/CodeBlockRenderer.tsx

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

import { Button } from "@/components/ui/button";
import { CheckIcon, ClipboardIcon, ChevronsUpDownIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

interface CodeBlockRendererProps {
  lang: string | undefined;
  code: string;
  isStreaming?: boolean;
}

// IDs for theme link elements
const PRISM_THEME_LINK_ID = "prism-theme-link";
const DEFAULT_LIGHT_THEME_LINK_ID = "prism-default-light-theme-link";
const DEFAULT_DARK_THEME_LINK_ID = "prism-default-dark-theme-link";

// Default theme URLs as specified
const DEFAULT_LIGHT_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-light.min.css";
const DEFAULT_DARK_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-coldark-dark.min.css";

// Helper function to get raw content URL from GitHub
const getRawGitHubUrl = (url: string): string => {
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
};

// Wrap the component logic in a named function before memo
const CodeBlockRendererComponent: React.FC<CodeBlockRendererProps> = ({
  lang,
  code,
  isStreaming = false,
}) => {
  const {
    prismThemeUrl,
    theme: appTheme,
    foldStreamingCodeBlocks,
  } = useSettingsStore(
    useShallow((state) => ({
      prismThemeUrl: state.prismThemeUrl,
      theme: state.theme,
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    })),
  );

  const [isCopied, setIsCopied] = useState(false);
  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false,
  );
  const codeRef = useRef<HTMLElement>(null);

  const systemTheme = useMemo(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, []);

  const currentTheme = appTheme === "system" ? systemTheme : appTheme;

  useEffect(() => {
    const loadTheme = (url: string, id: string): void => {
      const existingLink = document.getElementById(
        id,
      ) as HTMLLinkElement | null;
      if (existingLink) {
        if (existingLink.href !== url) existingLink.href = url;
      } else {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
      }
    };
    const removeTheme = (id: string): void => {
      const existingLink = document.getElementById(id);
      if (existingLink) existingLink.remove();
    };

    if (prismThemeUrl) {
      loadTheme(prismThemeUrl, PRISM_THEME_LINK_ID);
      removeTheme(DEFAULT_LIGHT_THEME_LINK_ID);
      removeTheme(DEFAULT_DARK_THEME_LINK_ID);
    } else {
      removeTheme(PRISM_THEME_LINK_ID);
      if (currentTheme === "dark") {
        loadTheme(
          getRawGitHubUrl(DEFAULT_DARK_THEME_URL),
          DEFAULT_DARK_THEME_LINK_ID,
        );
        removeTheme(DEFAULT_LIGHT_THEME_LINK_ID);
      } else {
        loadTheme(
          getRawGitHubUrl(DEFAULT_LIGHT_THEME_URL),
          DEFAULT_LIGHT_THEME_LINK_ID,
        );
        removeTheme(DEFAULT_DARK_THEME_LINK_ID);
      }
    }
  }, [prismThemeUrl, currentTheme]);

  const highlightCode = useCallback(() => {
    if (codeRef.current && code) {
      try {
        // force pre-wrap DO NOT REMOVE !
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
`,
      )
      .slice(0, 3).join(`
`);
  }, [code]);

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      {/* Apply sticky positioning and background to the header */}
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">
            {lang ? lang.toUpperCase() : "CODE"}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
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
        <div></div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          {/* Ensure pre tag handles horizontal scroll and word breaks */}
          <pre className="overflow-x-auto w-full relative overflow-wrap-anywhere">
            {/* Remove min-w-full from code tag */}
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

// Export the memoized component
export const CodeBlockRenderer = memo(CodeBlockRendererComponent);
