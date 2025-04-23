
import type {
  CustomSettingTab,
  CustomPromptAction,
  CustomMessageAction,
  DbProviderConfig,
  DbProviderType,
  DbMessage, // Import DbMessage
  Message, // Import Message
  CoreMessage, // Import CoreMessage
  MessageContent, // Import MessageContent
  Role, // Import Role
} from "@/lib/types";


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

/**
 * Converts an array of DbMessage or Message objects to the CoreMessage format
 * expected by the AI SDK (filtering out non-user/assistant/system roles).
 */
export function convertDbMessagesToCoreMessages(
  messages: Array<DbMessage | Message>,
): CoreMessage[] {
  const validRoles: Role[] = ["user", "assistant", "system"];
  return messages
    .filter(
      (m) => validRoles.includes(m.role), // Filter only by valid roles for AI interaction
    )
    .map((m) => ({
      role: m.role,
      content: m.content as MessageContent, // Cast content, assuming it's already correct
      // Add tool_calls and tool_call_id if they exist and are needed by the SDK format
      // tool_calls: m.toolCalls, // Example if tool calls were stored
      // tool_call_id: m.toolCallId, // Example if tool call ID was stored
    })) as CoreMessage[]; // Cast the final array to CoreMessage[]
}


export const EMPTY_CUSTOM_SETTINGS_TABS: CustomSettingTab[] = [];
export const EMPTY_CUSTOM_PROMPT_ACTIONS: CustomPromptAction[] = [];
export const EMPTY_CUSTOM_MESSAGE_ACTIONS: CustomMessageAction[] = [];
export const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];


export const ensureV1Path = (baseUrl: string): string => {
  try {
    // Trim trailing slashes ONLY for the final return value if needed,
    // but perform checks on the original or slightly modified string.
    const trimmedForV1Check = baseUrl.replace(/\/+$/, ""); // Trim only for the /v1 check

    if (trimmedForV1Check.endsWith("/v1")) {
      return trimmedForV1Check; // Return the version ending in /v1 (already trimmed)
    } else if (baseUrl.endsWith("/")) {
      // Ends with '/', append 'v1'
      return baseUrl + "v1";
    } else {
      // Doesn't end with '/' or '/v1', append '/v1'
      return baseUrl + "/v1";
    }
  } catch (e) {
    console.error("Error processing base URL for /v1 path:", baseUrl, e);
    // Fallback: return original URL trimmed of trailing slashes
    return baseUrl.replace(/\/+$/, "");
  }
};
