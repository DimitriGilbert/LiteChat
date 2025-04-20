// src/hooks/ai-interaction/tool-handler.ts
import { tool, Tool as VercelTool, ToolExecutionOptions } from "ai";
import { RegisteredToolEntry } from "@/context/mod-context";

/**
 * Creates SDK-compatible tools from registered mod tools
 */
export function createSdkTools(
  modTools: ReadonlyMap<string, RegisteredToolEntry>,
  getContextSnapshotForMod: () => any,
): Record<string, VercelTool<any, any>> {
  const toolsForSdk: Record<string, VercelTool<any, any>> = {};

  modTools.forEach((registeredTool: RegisteredToolEntry, toolName: string) => {
    if (!registeredTool.definition.parameters) {
      console.error(
        `Tool "${toolName}" is missing parameters definition. Skipping.`,
      );
      return;
    }

    const originalExecuteFn =
      registeredTool.implementation ?? registeredTool.definition.execute;

    if (!originalExecuteFn) {
      console.error(
        `Tool "${toolName}" is missing an implementation or execute function. Skipping.`,
      );
      return;
    }

    toolsForSdk[toolName] = tool({
      description: registeredTool.definition.description,
      parameters: registeredTool.definition.parameters,
      execute: async (args: any, options: ToolExecutionOptions) => {
        const contextSnapshot = getContextSnapshotForMod();
        try {
          console.log(options);
          const result = await originalExecuteFn(args, contextSnapshot);
          return result;
        } catch (error) {
          console.error(`Error executing tool "${toolName}":`, error);
          throw error;
        }
      },
    });
  });

  return toolsForSdk;
}
