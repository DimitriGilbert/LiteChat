// src/store/core-chat.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { db } from "@/lib/db";
import type {
  Message,
  DbMessage,
  MessageContent,
  Workflow,
  AiModelConfig,
  AiProviderConfig,
} from "@/lib/types";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import {
  WorkflowExecutionService,
  WorkflowTask,
} from "@/services/workflow-execution-service"; // Import service
import { workflowEvents, WorkflowEvent } from "@/services/workflow-events"; // Import events
import Dexie from "dexie";

// Helper function (consider moving to utils)
const findMessageAndParent = (
  messages: Message[],
  messageId: string,
): { message: Message | null; parent: Message | null } => {
  for (const msg of messages) {
    if (msg.id === messageId) {
      return { message: msg, parent: null };
    }
    if (msg.children) {
      for (const child of msg.children) {
        if (child.id === messageId) {
          return { message: child, parent: msg };
        }
        // Recursive search if needed, but workflows are currently 1 level deep
      }
    }
  }
  return { message: null, parent: null };
};

interface CoreChatState {
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean; // Represents if *any* stream (single or workflow task) is active
  error: string | null;
  // Store active workflow services, keyed by parent message ID
  activeWorkflows: Map<string, WorkflowExecutionService>;
}

export interface CoreChatActions {
  loadMessages: (conversationId: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>; // Returns void, AI call triggered separately
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>; // Returns void, AI call triggered separately
  stopStreamingCore: (parentMessageId?: string | null) => void; // Accept optional parent ID
  regenerateMessageCore: (messageId: string) => Promise<void>;
  // New Workflow Actions
  startWorkflowCore: (
    conversationId: string,
    command: string, // e.g., "/race model1,model2 The prompt"
    getApiKey: (providerId: string) => string | undefined,
    getProvider: (id: string) => AiProviderConfig | undefined,
    getModel: (
      providerId: string,
      modelId: string,
    ) => AiModelConfig | undefined,
  ) => Promise<void>;
  finalizeWorkflowTask: (
    parentMessageId: string,
    taskId: string,
    finalChildMessage: Message,
    error?: Error | string | null,
  ) => void;
  _subscribeToWorkflowEvents: () => () => void; // Internal subscription management
}

export const useCoreChatStore = create(
  immer<CoreChatState & CoreChatActions>((set, get) => ({
    messages: [],
    isLoadingMessages: false,
    isStreaming: false,
    error: null,
    activeWorkflows: new Map(),

    loadMessages: async (conversationId) => {
      set({ isLoadingMessages: true, messages: [], error: null });
      try {
        const dbMessages = await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, Dexie.maxKey],
          )
          .sortBy("createdAt");

        // Basic mapping, assuming children are stored correctly
        const uiMessages = dbMessages.map(
          (dbMsg): Message => ({
            id: dbMsg.id,
            role: dbMsg.role,
            content: dbMsg.content,
            conversationId: dbMsg.conversationId,
            createdAt: dbMsg.createdAt,
            vfsContextPaths: dbMsg.vfsContextPaths,
            tool_calls: dbMsg.tool_calls,
            tool_call_id: dbMsg.tool_call_id,
            children: dbMsg.children, // Map children
            workflow: dbMsg.workflow, // Map workflow
            providerId: dbMsg.providerId,
            modelId: dbMsg.modelId,
            tokensInput: dbMsg.tokensInput,
            tokensOutput: dbMsg.tokensOutput,
            isStreaming: false, // Assume not streaming on load
            error: null,
          }),
        );
        set({ messages: uiMessages, isLoadingMessages: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to load messages:", err);
        set({
          error: `Failed to load messages: ${message}`,
          isLoadingMessages: false,
        });
        toast.error(`Failed to load messages: ${message}`);
      }
    },

    setMessages: (messages) => {
      set({ messages });
    },

    addMessage: (message) => {
      set((state) => {
        // Prevent duplicates
        if (!state.messages.some((m) => m.id === message.id)) {
          state.messages.push(message);
        } else {
          console.warn(`Attempted to add duplicate message ID: ${message.id}`);
        }
      });
    },

    updateMessage: (id, updates) => {
      set((state) => {
        const messageIndex = state.messages.findIndex((m) => m.id === id);
        if (messageIndex !== -1) {
          Object.assign(state.messages[messageIndex], updates);
          // If updating children, ensure they are also updated if needed
        } else {
          // Check if it's a child message
          for (const parent of state.messages) {
            if (parent.children) {
              const childIndex = parent.children.findIndex((c) => c.id === id);
              if (childIndex !== -1) {
                Object.assign(parent.children[childIndex], updates);
                // If the child is no longer streaming, check parent status
                if (updates.isStreaming === false && parent.workflow) {
                  const allChildrenDone = parent.children.every(
                    (c) => !c.isStreaming,
                  );
                  if (allChildrenDone) {
                    parent.workflow.status = updates.error
                      ? "error"
                      : "completed";
                    // Check if overall streaming state needs update
                    const anyStreaming = state.messages.some(
                      (m) =>
                        m.isStreaming || m.children?.some((c) => c.isStreaming),
                    );
                    if (!anyStreaming) {
                      state.isStreaming = false;
                    }
                  }
                }
                return; // Exit after updating child
              }
            }
          }
          console.warn(`Message with ID ${id} not found for update.`);
        }
      });
    },

    setIsStreaming: (isStreaming) => {
      set({ isStreaming });
    },

    setError: (error) => {
      set({ error });
    },

    addDbMessage: async (messageData) => {
      // This remains largely the same, handling single message saves
      if (!messageData.conversationId) {
        throw new Error("Cannot add message without a conversationId");
      }
      const newMessage: DbMessage = {
        id: messageData.id ?? nanoid(),
        createdAt: messageData.createdAt ?? new Date(),
        role: messageData.role,
        content: messageData.content,
        conversationId: messageData.conversationId,
        vfsContextPaths: messageData.vfsContextPaths,
        tool_calls: messageData.tool_calls,
        tool_call_id: messageData.tool_call_id,
        children: messageData.children, // Save children
        workflow: messageData.workflow, // Save workflow
        providerId: messageData.providerId,
        modelId: messageData.modelId,
        tokensInput: messageData.tokensInput,
        tokensOutput: messageData.tokensOutput,
      };
      await db.messages.add(newMessage);
      await db.conversations.update(messageData.conversationId, {
        updatedAt: new Date(),
      });
      return newMessage.id;
    },

    bulkAddMessages: async (messages) => {
      // This remains largely the same
      if (messages.length === 0) return;
      const latestMessage = messages.reduce((latest, current) =>
        latest.createdAt > current.createdAt ? latest : current,
      );
      const conversationId = latestMessage.conversationId;
      await db.transaction(
        "rw",
        db.messages,
        db.conversations,
        db.projects,
        async () => {
          await db.messages.bulkAdd(messages);
          await db.conversations.update(conversationId, {
            updatedAt: new Date(),
          });
          // Update project timestamp if needed
        },
      );
    },

    // Core submission for *single* user messages (text or image prompt)
    handleSubmitCore: async (
      currentConversationId,
      contentToSendToAI,
      vfsContextPaths,
    ) => {
      const userMessage: Message = {
        id: nanoid(),
        role: "user",
        content: contentToSendToAI,
        createdAt: new Date(),
        conversationId: currentConversationId,
        vfsContextPaths: vfsContextPaths,
      };
      get().addMessage(userMessage); // Add to UI immediately
      try {
        await get().addDbMessage(userMessage); // Save to DB
        console.log("User message saved:", userMessage.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        get().setError(`Failed to save user message: ${message}`);
        toast.error(`Failed to save user message: ${message}`);
        // Remove the message from UI if save failed? Or mark with error?
        get().updateMessage(userMessage.id, { error: "Save failed" });
        throw err; // Re-throw so the caller knows submission failed
      }
      // IMPORTANT: The actual AI call (performAiStream) is now triggered *after* this function completes successfully in useLiteChatLogic.
    },

    handleImageGenerationCore: async (currentConversationId, prompt) => {
      const userMessage: Message = {
        id: nanoid(),
        role: "user",
        content: `/imagine ${prompt}`, // Store the command
        createdAt: new Date(),
        conversationId: currentConversationId,
      };
      get().addMessage(userMessage); // Add to UI immediately
      try {
        await get().addDbMessage(userMessage); // Save to DB
        console.log("User image prompt message saved:", userMessage.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        get().setError(`Failed to save image prompt: ${message}`);
        toast.error(`Failed to save image prompt: ${message}`);
        get().updateMessage(userMessage.id, { error: "Save failed" });
        throw err; // Re-throw
      }
      // IMPORTANT: The actual AI call (performImageGeneration) is now triggered *after* this function completes successfully in useLiteChatLogic.
    },

    stopStreamingCore: (parentMessageId = null) => {
      set((state) => {
        if (parentMessageId) {
          // Cancel a specific workflow
          const service = state.activeWorkflows.get(parentMessageId);
          if (service) {
            service.cancelWorkflow(parentMessageId);
            state.activeWorkflows.delete(parentMessageId); // Remove from active map
            // Update parent message status in UI if needed
            const parentIndex = state.messages.findIndex(
              (m) => m.id === parentMessageId,
            );
            if (parentIndex !== -1 && state.messages[parentIndex].workflow) {
              state.messages[parentIndex].workflow!.status = "error"; // Or 'cancelled' if distinct status needed
              // Ensure children are marked as not streaming
              state.messages[parentIndex].children?.forEach((child) => {
                child.isStreaming = false;
                child.error = child.error || "Cancelled by user";
              });
            }
          }
        } else {
          // Cancel the *last* single streaming message (non-workflow)
          const streamingMessage = state.messages.find(
            (m) => m.isStreaming && !m.workflow,
          );
          if (streamingMessage) {
            state.updateMessage(streamingMessage.id, {
              isStreaming: false,
              error: "Cancelled by user",
              streamedContent: undefined, // Clear partial content
            });
          }
          // Also cancel any remaining active workflows if stopping globally?
          // state.activeWorkflows.forEach(service => service.cancelWorkflow());
          // state.activeWorkflows.clear();
        }

        // Recalculate global streaming state
        const anyStreaming = state.messages.some(
          (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
        );
        state.isStreaming = anyStreaming;
        if (!anyStreaming) {
          // If nothing is streaming, clear the global abort controller ref if it exists
          // This needs access to the ref, which is tricky from the store.
          // The hook (`useLiteChatLogic`) should handle clearing the ref.
          console.log("CoreStore: All streaming stopped.");
        }
      });
    },

    regenerateMessageCore: async (messageId) => {
      set((state) => {
        let messageToDeleteId: string | null = null;
        let isWorkflowParent = false;
        let isWorkflowChild = false;
        let parentWorkflowMessage: Message | null = null;

        const { message, parent } = findMessageAndParent(
          state.messages,
          messageId,
        );

        if (!message) {
          console.error(`Message ${messageId} not found for regeneration.`);
          toast.error("Cannot regenerate: Message not found.");
          return;
        }

        if (parent && parent.workflow) {
          // Regenerating a child of a workflow
          isWorkflowChild = true;
          parentWorkflowMessage = parent;
          messageToDeleteId = messageId; // Delete the specific child
          // Remove the child from the parent's children array
          parent.children = parent.children?.filter((c) => c.id !== messageId);
        } else if (message.workflow) {
          // Regenerating a workflow parent
          isWorkflowParent = true;
          messageToDeleteId = messageId; // Delete the parent and its children implicitly
        } else if (message.role === "assistant") {
          // Regenerating a regular assistant message
          messageToDeleteId = messageId;
        } else {
          console.error(
            `Cannot regenerate message role: ${message.role}`,
            message,
          );
          toast.error("Cannot regenerate this message type.");
          return;
        }

        // Delete the target message(s) from UI state
        if (messageToDeleteId) {
          state.messages = state.messages.filter(
            (m) => m.id !== messageToDeleteId,
          );
        }

        // Stop any related streaming
        if (isWorkflowParent && messageToDeleteId) {
          get().stopStreamingCore(messageToDeleteId);
        } else if (isWorkflowChild && parentWorkflowMessage) {
          // Stop potentially just the single task? Or the whole workflow?
          // For simplicity, let's stop the whole workflow if a child is regenerated.
          get().stopStreamingCore(parentWorkflowMessage.id);
        } else {
          get().stopStreamingCore(); // Stop any single stream
        }
      });

      // Delete from DB after UI update
      // This part needs careful implementation based on the message type
      // For now, we assume the caller (`useLiteChatLogic`) handles the DB deletion
      // and re-triggering logic based on the message type.
      // await db.messages.delete(messageToDeleteId); // Be careful with cascade deletes if needed
      console.log(
        `Regenerate: UI state prepared for message ${messageId}. DB deletion and re-triggering handled by caller.`,
      );
    },

    // --- New Workflow Actions ---

    startWorkflowCore: async (
      conversationId,
      command,
      getApiKey,
      getProvider,
      getModel,
    ) => {
      set({ error: null }); // Clear previous errors

      // 1. Parse Command (Simple Example: /race model1,model2 Prompt)
      const raceMatch = command.match(/^\/race\s+([\w.,-]+)\s+(.*)/s);
      let workflowType: Workflow["type"] | null = null;
      let modelIds: string[] = [];
      let promptText = "";

      if (raceMatch) {
        workflowType = "race";
        modelIds = raceMatch[1].split(",").map((s) => s.trim());
        promptText = raceMatch[2].trim();
      } else {
        toast.error("Invalid workflow command format.");
        set({ error: "Invalid workflow command format." });
        return;
      }

      if (!promptText || modelIds.length === 0) {
        toast.error("Workflow command requires models and a prompt.");
        set({ error: "Workflow command requires models and a prompt." });
        return;
      }

      // 2. Create Parent User Message
      const parentMessageId = nanoid();
      const parentMessage: Message = {
        id: parentMessageId,
        role: "user", // Or a dedicated 'workflow-trigger' role?
        content: command, // Store the original command
        createdAt: new Date(),
        conversationId: conversationId,
        workflow: {
          type: workflowType,
          status: "pending",
          childIds: [], // Will be populated as tasks start/finish
        },
        children: [], // Initialize empty children array
      };

      get().addMessage(parentMessage); // Add parent to UI
      try {
        await get().addDbMessage(parentMessage); // Save parent to DB
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        get().setError(`Failed to save workflow trigger: ${message}`);
        toast.error(`Failed to save workflow trigger: ${message}`);
        get().updateMessage(parentMessage.id, { error: "Save failed" });
        return; // Stop if parent save fails
      }

      // 3. Prepare Tasks
      const tasks: WorkflowTask[] = [];
      const childPlaceholders: Message[] = [];
      const now = new Date();

      // Get message history *before* the parent message
      const history = get().messages.filter((m) => m.id !== parentMessageId);
      const coreHistory = convertDbMessagesToCoreMessages(history);

      for (const modelId of modelIds) {
        // Find the provider for this model (assuming models are unique across enabled providers for now)
        // A more robust approach would involve specifying provider/model pairs in the command.
        let taskProvider: AiProviderConfig | undefined;
        let taskModel: AiModelConfig | undefined;
        const providers = Object.values(
          useProviderStore.getState().dbProviderConfigs,
        ); // Get providers from provider store

        for (const pConfig of providers) {
          const modelInfo = pConfig.fetchedModels?.find(
            (m) => m.id === modelId,
          );
          if (modelInfo) {
            taskProvider = getProvider(pConfig.id); // Use passed getter
            taskModel = getModel(pConfig.id, modelId); // Use passed getter
            break;
          }
        }

        if (!taskProvider || !taskModel || !taskModel.instance) {
          toast.error(`Could not find or instantiate model: ${modelId}`);
          get().setError(`Could not find or instantiate model: ${modelId}`);
          // TODO: How to handle partial failure? Cancel workflow?
          continue; // Skip this model
        }

        const taskId = nanoid();
        tasks.push({
          taskId: taskId,
          config: {
            model: taskModel,
            provider: taskProvider,
            messages: [...coreHistory, { role: "user", content: promptText }], // Use prompt for this task
            // Add other parameters (temp, etc.) if needed, maybe from global settings?
            temperature: useSettingsStore.getState().temperature,
            maxTokens: useSettingsStore.getState().maxTokens,
          },
        });

        // Create placeholder child message for UI
        childPlaceholders.push({
          id: taskId,
          role: "assistant",
          content: "",
          streamedContent: "",
          isStreaming: true, // Mark as streaming initially
          createdAt: now,
          conversationId: conversationId,
          providerId: taskProvider.id,
          modelId: taskModel.id,
          error: null,
        });
      }

      if (tasks.length === 0) {
        toast.error("No valid models found for the workflow.");
        get().setError("No valid models found for the workflow.");
        // Update parent message status?
        get().updateMessage(parentMessageId, {
          workflow: { ...parentMessage.workflow!, status: "error" },
        });
        return;
      }

      // 4. Update Parent Message with Placeholders and Start Workflow
      set((state) => {
        const parentIndex = state.messages.findIndex(
          (m) => m.id === parentMessageId,
        );
        if (parentIndex !== -1) {
          state.messages[parentIndex].children = childPlaceholders;
          state.messages[parentIndex].workflow!.status = "running";
          state.messages[parentIndex].workflow!.childIds = tasks.map(
            (t) => t.taskId,
          );
        }
        state.isStreaming = true; // Set global streaming state

        // Instantiate and store the service
        const workflowService = new WorkflowExecutionService({ getApiKey });
        state.activeWorkflows.set(parentMessageId, workflowService);

        // Start execution (don't await here, let it run in background)
        workflowService
          .startWorkflow(parentMessageId, workflowType, tasks)
          .catch((err) => {
            // Handle potential errors during workflow setup/execution not caught by task errors
            console.error(`Workflow ${parentMessageId} failed globally:`, err);
            const message = err instanceof Error ? err.message : String(err);
            // Update parent status if not already errored
            set((s) => {
              const pIdx = s.messages.findIndex(
                (m) => m.id === parentMessageId,
              );
              if (
                pIdx !== -1 &&
                s.messages[pIdx].workflow?.status !== "error"
              ) {
                s.messages[pIdx].workflow!.status = "error";
              }
              // Ensure global streaming state is updated if this was the last one
              const anyStreaming = s.messages.some(
                (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
              );
              s.isStreaming = anyStreaming;
            });
          })
          .finally(() => {
            // Clean up service instance from map once workflow is fully done/errored
            set((s) => {
              s.activeWorkflows.delete(parentMessageId);
              // Check global streaming state again after cleanup
              const anyStreaming = s.messages.some(
                (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
              );
              s.isStreaming = anyStreaming;
            });
          });
      });
    },

    finalizeWorkflowTask: (
      parentMessageId,
      taskId,
      finalChildMessage,
      error = null,
    ) => {
      set((state) => {
        const parentIndex = state.messages.findIndex(
          (m) => m.id === parentMessageId,
        );
        if (parentIndex === -1 || !state.messages[parentIndex].children) {
          console.warn(
            `Parent message ${parentMessageId} or its children not found for finalizing task ${taskId}`,
          );
          return;
        }

        const parent = state.messages[parentIndex];
        const childIndex = parent.children!.findIndex((c) => c.id === taskId);

        if (childIndex !== -1) {
          // Update the existing placeholder child
          Object.assign(parent.children![childIndex], {
            ...finalChildMessage, // Apply final data
            isStreaming: false,
            streamedContent: undefined,
            error: error instanceof Error ? error.message : error,
          });
        } else {
          // Should not happen if placeholders were added correctly
          console.error(
            `Child placeholder ${taskId} not found in parent ${parentMessageId}. Adding final message directly.`,
          );
          parent.children!.push({
            ...finalChildMessage,
            isStreaming: false,
            streamedContent: undefined,
            error: error instanceof Error ? error.message : error,
          });
        }

        // Update parent workflow status if all children are done
        const allChildrenDone = parent.children!.every((c) => !c.isStreaming);
        if (allChildrenDone && parent.workflow) {
          const hasError = parent.children!.some((c) => c.error);
          parent.workflow.status = hasError ? "error" : "completed";

          // Save the updated parent message with completed children to DB
          // Debounce this? Or save only once when workflow completes?
          // For simplicity, save on each task completion for now.
          db.messages
            .update(parentMessageId, {
              children: parent.children, // Save final children state
              workflow: parent.workflow, // Save final workflow state
            })
            .catch((dbErr) =>
              console.error(
                `Failed to update parent message ${parentMessageId} in DB after task ${taskId} completion:`,
                dbErr,
              ),
            );
        }

        // Recalculate global streaming state
        const anyStreaming = state.messages.some(
          (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
        );
        state.isStreaming = anyStreaming;
      });
    },

    // Internal function to set up listeners
    _subscribeToWorkflowEvents: () => {
      const handleTaskFinish = ({
        parentMessageId,
        taskId,
        result,
      }: {
        parentMessageId: string;
        taskId: string;
        result: Message;
      }) => {
        get().finalizeWorkflowTask(parentMessageId, taskId, result);
      };

      const handleTaskError = ({
        parentMessageId,
        taskId,
        error,
      }: {
        parentMessageId: string;
        taskId: string;
        error: Error | string;
      }) => {
        // Create a dummy message object representing the error state
        const errorChildMessage: Message = {
          id: taskId,
          role: "assistant",
          content: "", // No content on error
          createdAt: new Date(),
          conversationId: parentMessageId,
          isStreaming: false,
          error: error instanceof Error ? error.message : error,
        };
        get().finalizeWorkflowTask(
          parentMessageId,
          taskId,
          errorChildMessage,
          error,
        );
      };

      // Subscribe
      workflowEvents.on(WorkflowEvent.TASK_FINISH, handleTaskFinish);
      workflowEvents.on(WorkflowEvent.TASK_ERROR, handleTaskError);

      // Return unsubscribe function
      return () => {
        workflowEvents.off(WorkflowEvent.TASK_FINISH, handleTaskFinish);
        workflowEvents.off(WorkflowEvent.TASK_ERROR, handleTaskError);
      };
    },
  })),
);

// --- Initialize Event Subscription ---
// Call the internal subscription function once when the store is created.
// The unsubscribe function is returned but might not be needed unless the app unmounts entirely.
export const unsubscribeWorkflowEvents = useCoreChatStore
  .getState()
  ._subscribeToWorkflowEvents();
// You might want to store `unsubscribeWorkflowEvents` somewhere if you need to call it later.
