// src/hooks/ai-interaction/tool-handler.ts
import { tool, Tool as VercelTool, ToolExecutionOptions } from "ai";
// Removed import for RegisteredToolEntry from context
import type { ReadonlyChatContextSnapshot } from "@/mods/api";
import type { z } from "zod";
// Import Tool and ToolImplementation from the correct location
import type { Tool, ToolImplementation } from "@/mods/tools";
// Import the store to access modTools
import { useModStore } from "@/store/mod.store";

// Define RegisteredToolEntry locally as it's no longer exported
export interface RegisteredToolEntry {
  definition: Tool<any>;
  implementation?: ToolImplementation<any>;
}

/**
 * Creates SDK-compatible tools from registered mod tools.
 * Ensures that tools have necessary definitions and implementations.
 */
export function createSdkTools(
  // modTools: ReadonlyMap<string, RegisteredToolEntry>, // Removed parameter
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot,
): Record<string, VercelTool<any, any>> {
  // Get modTools directly from the store state
  const modTools = useModStore.getState().modTools;
  const toolsForSdk: Record<string, VercelTool<any, any>> = {};

  modTools.forEach((registeredTool: RegisteredToolEntry, toolName: string) => {
    // Validate that parameters definition exists
    if (!registeredTool.definition.parameters) {
      console.error(
        `[ToolHandler] Tool "${toolName}" is missing parameters definition. Skipping.`,
      );
      return;
    }

    // Determine the execution function (prefer implementation if provided)
    const executeFn =
      registeredTool.implementation ?? registeredTool.definition.execute;

    // Validate that an execution function exists
    if (!executeFn) {
      console.error(
        `[ToolHandler] Tool "${toolName}" is missing an implementation or execute function in its definition. Skipping.`,
      );
      return;
    }

    // Create the tool compatible with the Vercel AI SDK
    toolsForSdk[toolName] = tool({
      description: registeredTool.definition.description,
      parameters: registeredTool.definition.parameters as z.ZodSchema<any>, // Ensure type compatibility
      execute: async (args: any, options?: ToolExecutionOptions) => {
        // Get context snapshot *inside* the execute function to ensure freshness
        const contextSnapshot = getContextSnapshotForMod();
        try {
          console.log(
            `[ToolHandler] Executing tool "${toolName}" with args:`,
            args,
            "Options:",
            options,
          );
          // Call the original implementation/definition execute function
          const result = await executeFn(args, contextSnapshot);
          console.log(`[ToolHandler] Tool "${toolName}" result:`, result);
          return result;
        } catch (error) {
          console.error(
            `[ToolHandler] Error executing tool "${toolName}":`,
            error,
          );
          // Re-throw the error so the AI SDK can handle it appropriately
          throw error;
        }
      },
    });
  });

  return toolsForSdk;
}
