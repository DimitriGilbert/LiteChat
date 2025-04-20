// src/mods/tools.ts
import { z } from "zod";
import type { ReadonlyChatContextSnapshot } from "./api";

/**
 * Defines the structure for a tool that can be called by the AI model.
 * Aligned with the Vercel AI SDK tool definition.
 */
export interface Tool<PARAMETERS extends z.ZodSchema<any> = z.ZodSchema<any>> {
  /** A description of the tool that the model can use to decide when to call it. */
  description?: string;
  /** A Zod schema defining the parameters the tool accepts. */
  parameters: PARAMETERS;
  /**
   * An optional function to execute the tool's logic.
   * If provided here, it's used directly. Otherwise, a separate implementation must be registered.
   * @param args - The parsed arguments matching the `parameters` schema.
   * @param context - A read-only snapshot of the chat context at the time of execution.
   * @returns The result of the tool execution.
   */
  execute?: (
    args: z.infer<PARAMETERS>,
    context: ReadonlyChatContextSnapshot,
  ) => Promise<any>;
}

/**
 * Represents the function signature for a tool's implementation logic.
 * @param args - The parsed arguments matching the tool's `parameters` schema.
 * @param context - A read-only snapshot of the chat context at the time of execution.
 * @returns The result of the tool execution.
 */
export type ToolImplementation<
  PARAMETERS extends z.ZodSchema<any> = z.ZodSchema<any>,
> = (
  args: z.infer<PARAMETERS>,
  context: ReadonlyChatContextSnapshot,
) => Promise<any>;
