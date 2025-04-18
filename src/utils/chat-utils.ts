// src/utils/chat-utils.ts
import type { CustomSettingTab, CustomPromptAction, CustomMessageAction, DbProviderConfig, DbProviderType } from "@/lib/types";

// Helper functions
export const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn(
      "Failed to decode Uint8Array as strict UTF-8, trying lossy:",
      e,
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

export const CODE_FILE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "scss",
  "less",
  "php",
  "py",
  "rb",
  "java",
  "cpp",
  "c",
  "cs",
  "go",
  "rs",
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "sql",
  "md",
  "markdown",
  "txt",
  "rst",
  "sh",
  "bash",
  "zsh",
  "fish",
  "bat",
  "ps1",
  "env",
  "ini",
  "conf",
  "config",
  "toml",
  "gradle",
  "dockerfile",
  "gitignore",
]);

export const isCodeFile = (filename: string): boolean => {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return CODE_FILE_EXTENSIONS.has(extension);
};

export const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

export const EMPTY_CUSTOM_SETTINGS_TABS: CustomSettingTab[] = [];
export const EMPTY_CUSTOM_PROMPT_ACTIONS: CustomPromptAction[] = [];
export const EMPTY_CUSTOM_MESSAGE_ACTIONS: CustomMessageAction[] = [];
export const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];