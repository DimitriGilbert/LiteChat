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
  DbProviderConfig, // Keep this import
} from "@/lib/types";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import {
  WorkflowExecutionService,
  WorkflowTask,
} from "@/services/workflow-execution-service";
import { workflowEvents, WorkflowEvent } from "@/services/workflow-events";
import Dexie from "dexie";
// Removed useProviderStore import from here, it's not needed directly in this file anymore for dbProviderConfigs
import { useSettingsStore } from "./settings.store";

// Helper function remains the same
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
      }
    }
  }
  return { message: null, parent: null };
};

interface CoreChatState {
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  error: string | null;
  activeWorkflows: Map<string, WorkflowExecutionService>;
}

export interface CoreChatActions {
  loadMessages: (conversationId: string | null) => Promise<void>;
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
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  stopStreamingCore: (parentMessageId?: string | null) => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  // Modified signature: Added dbProviderConfigs parameter
  startWorkflowCore: (
    conversationId: string,
    command: string,
    getApiKey: (providerId: string) => string | undefined,
    getProvider: (id: string) => AiProviderConfig | undefined,
    getModel: (
      providerId: string,
      modelId: string,
    ) => AiModelConfig | undefined,
    dbProviderConfigs: DbProviderConfig[], // Added parameter
  ) => Promise<void>;
  finalizeWorkflowTask: (
    parentMessageId: string,
    taskId: string,
    finalChildMessage: Message,
    error?: Error | string | null,
  ) => void;
  _subscribeToWorkflowEvents: () => () => void;
}

export const useCoreChatStore = create(
  immer<CoreChatState & CoreChatActions>((set, get) => ({
    messages: [],
    isLoadingMessages: false,
    isStreaming: false,
    error: null,
    activeWorkflows: new Map(),

    loadMessages: async (conversationId) => {
      if (!conversationId) {
        set({ messages: [], isLoadingMessages: false, error: null });
        return;
      }
      set({ isLoadingMessages: true, messages: [], error: null });
      try {
        const dbMessages = await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, Dexie.maxKey],
          )
          .sortBy("createdAt");

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
            children: dbMsg.children,
            workflow: dbMsg.workflow,
            providerId: dbMsg.providerId,
            modelId: dbMsg.modelId,
            tokensInput: dbMsg.tokensInput,
            tokensOutput: dbMsg.tokensOutput,
            isStreaming: false,
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
        if (!state.messages.some((m) => m.id === message.id)) {
          state.messages.push(message);
        } else {
          console.warn(`Attempted to add duplicate message ID: ${message.id}`);
        }
      });
    },

    updateMessage: (id, updates) => {
      set((state) => {
        let messageUpdated = false;
        const messageIndex = state.messages.findIndex((m) => m.id === id);

        if (messageIndex !== -1) {
          Object.assign(state.messages[messageIndex], updates);
          messageUpdated = true;
        } else {
          // Check children
          for (const parent of state.messages) {
            if (parent.children) {
              const childIndex = parent.children.findIndex((c) => c.id === id);
              if (childIndex !== -1) {
                Object.assign(parent.children[childIndex], updates);
                messageUpdated = true;
                if (updates.isStreaming === false && parent.workflow) {
                  const allChildrenDone = parent.children.every(
                    (c) => !c.isStreaming,
                  );
                  if (allChildrenDone) {
                    parent.workflow.status = updates.error
                      ? "error"
                      : "completed";
                  }
                }
                break;
              }
            }
          }
        }

        if (!messageUpdated) {
          console.warn(`Message with ID ${id} not found for update.`);
        }

        // Recalculate global streaming state
        const anyStreaming = state.messages.some(
          (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
        );
        if (state.isStreaming !== anyStreaming) {
          state.isStreaming = anyStreaming;
        }
      });
    },

    setIsStreaming: (isStreaming) => {
      set((state) => {
        if (state.isStreaming !== isStreaming) {
          state.isStreaming = isStreaming;
        }
      });
    },

    setError: (error) => {
      set({ error });
    },

    addDbMessage: async (messageData) => {
      if (!messageData.conversationId) {
        console.error(
          "addDbMessage error: conversationId is missing.",
          messageData,
        );
        throw new Error("Cannot add message without a conversationId");
      }
      const newMessage: DbMessage = {
        id: messageData.id ?? nanoid(),
        createdAt: messageData.createdAt ?? new Date(),
        role: messageData.role,
        content: messageData.content,
        conversationId: messageData.conversationId,
        vfsContextPaths: messageData.vfsContextPaths ?? undefined,
        tool_calls: messageData.tool_calls ?? undefined,
        tool_call_id: messageData.tool_call_id ?? undefined,
        children: messageData.children ?? undefined,
        workflow: messageData.workflow ?? undefined,
        providerId: messageData.providerId ?? undefined,
        modelId: messageData.modelId ?? undefined,
        tokensInput: messageData.tokensInput ?? undefined,
        tokensOutput: messageData.tokensOutput ?? undefined,
      };
      await db.messages.add(newMessage);
      await db.conversations.update(messageData.conversationId, {
        updatedAt: new Date(),
      });
      return newMessage.id;
    },

    bulkAddMessages: async (messages) => {
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
        },
      );
    },

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
      get().addMessage(userMessage);
      try {
        if (!userMessage.conversationId) {
          throw new Error("Conversation ID missing for user message.");
        }
        await get().addDbMessage({
          ...userMessage,
          conversationId: userMessage.conversationId,
        });
        console.log("User message saved:", userMessage.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        get().setError(`Failed to save user message: ${message}`);
        toast.error(`Failed to save user message: ${message}`);
        get().updateMessage(userMessage.id, { error: "Save failed" });
        throw err;
      }
    },

    handleImageGenerationCore: async (currentConversationId, prompt) => {
      const userMessage: Message = {
        id: nanoid(),
        role: "user",
        content: `/imagine ${prompt}`,
        createdAt: new Date(),
        conversationId: currentConversationId,
      };
      get().addMessage(userMessage);
      try {
        if (!userMessage.conversationId) {
          throw new Error("Conversation ID missing for image prompt message.");
        }
        await get().addDbMessage({
          ...userMessage,
          conversationId: userMessage.conversationId,
        });
        console.log("User image prompt message saved:", userMessage.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        get().setError(`Failed to save image prompt: ${message}`);
        toast.error(`Failed to save image prompt: ${message}`);
        get().updateMessage(userMessage.id, { error: "Save failed" });
        throw err;
      }
    },

    stopStreamingCore: (parentMessageId = null) => {
      set((state) => {
        let stoppedSomething = false;

        if (parentMessageId) {
          const service = state.activeWorkflows.get(parentMessageId);
          if (service) {
            service.cancelWorkflow(parentMessageId);
            state.activeWorkflows.delete(parentMessageId);
            const parentIndex = state.messages.findIndex(
              (m) => m.id === parentMessageId,
            );
            if (parentIndex !== -1 && state.messages[parentIndex].workflow) {
              state.messages[parentIndex].workflow!.status = "error";
              state.messages[parentIndex].children?.forEach((child) => {
                if (child.isStreaming) {
                  child.isStreaming = false;
                  child.error = child.error || "Cancelled by user";
                  stoppedSomething = true;
                }
              });
            }
          }
        } else {
          for (let i = state.messages.length - 1; i >= 0; i--) {
            const msg = state.messages[i];
            if (msg.isStreaming && !msg.workflow) {
              console.log(
                `[CoreStore StopStreaming] Stopping single message: ${msg.id}`,
              );
              get().updateMessage(msg.id, {
                isStreaming: false,
                error: "Cancelled by user",
                streamedContent: undefined,
              });
              stoppedSomething = true;
              break;
            }
          }
        }

        if (stoppedSomething) {
          const anyStreaming = state.messages.some(
            (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
          );
          if (state.isStreaming !== anyStreaming) {
            state.isStreaming = anyStreaming;
            console.log(
              `[CoreStore StopStreaming] Global isStreaming set to: ${anyStreaming}`,
            );
          }
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
          isWorkflowChild = true;
          parentWorkflowMessage = parent;
          messageToDeleteId = messageId;
          parent.children = parent.children?.filter((c) => c.id !== messageId);
        } else if (message.workflow) {
          isWorkflowParent = true;
          messageToDeleteId = messageId;
        } else if (message.role === "assistant") {
          messageToDeleteId = messageId;
        } else {
          console.error(
            `Cannot regenerate message role: ${message.role}`,
            message,
          );
          toast.error("Cannot regenerate this message type.");
          return;
        }

        if (messageToDeleteId) {
          state.messages = state.messages.filter(
            (m) => m.id !== messageToDeleteId,
          );
        }

        if (isWorkflowParent && messageToDeleteId) {
          get().stopStreamingCore(messageToDeleteId);
        } else if (isWorkflowChild && parentWorkflowMessage) {
          get().stopStreamingCore(parentWorkflowMessage.id);
        } else {
          get().stopStreamingCore();
        }
      });
      console.log(
        `Regenerate: UI state prepared for message ${messageId}. DB deletion and re-triggering handled by caller.`,
      );
    },

    // Modified: Accept dbProviderConfigs as parameter
    startWorkflowCore: async (
      conversationId,
      command,
      getApiKey,
      getProvider,
      getModel,
      dbProviderConfigs, // Added parameter
    ) => {
      set({ error: null });

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

      const parentMessageId = nanoid();
      const parentMessage: Message = {
        id: parentMessageId,
        role: "user",
        content: command,
        createdAt: new Date(),
        conversationId: conversationId,
        workflow: {
          type: workflowType,
          status: "pending",
          childIds: [],
        },
        children: [],
      };

      get().addMessage(parentMessage);
      try {
        if (!parentMessage.conversationId) {
          throw new Error("Conversation ID missing for workflow parent.");
        }
        await get().addDbMessage({
          ...parentMessage,
          conversationId: parentMessage.conversationId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        get().setError(`Failed to save workflow trigger: ${message}`);
        toast.error(`Failed to save workflow trigger: ${message}`);
        get().updateMessage(parentMessage.id, { error: "Save failed" });
        return;
      }

      const tasks: WorkflowTask[] = [];
      const childPlaceholders: Message[] = [];
      const now = new Date();
      const history = get().messages.filter((m) => m.id !== parentMessageId);
      const coreHistory = convertDbMessagesToCoreMessages(history);

      for (const modelId of modelIds) {
        let taskProvider: AiProviderConfig | undefined;
        let taskModel: AiModelConfig | undefined;
        // Use the passed dbProviderConfigs instead of store state
        const providers = dbProviderConfigs;

        for (const pConfig of providers) {
          const modelInfo = pConfig.fetchedModels?.find(
            (m) => m.id === modelId,
          );
          if (modelInfo) {
            taskProvider = getProvider(pConfig.id);
            taskModel = getModel(pConfig.id, modelId);
            break;
          }
        }

        if (!taskProvider || !taskModel || !taskModel.instance) {
          toast.error(`Could not find or instantiate model: ${modelId}`);
          get().setError(`Could not find or instantiate model: ${modelId}`);
          continue;
        }

        const taskId = nanoid();
        tasks.push({
          taskId: taskId,
          config: {
            model: taskModel,
            provider: taskProvider,
            messages: [...coreHistory, { role: "user", content: promptText }],
            temperature: useSettingsStore.getState().temperature,
            maxTokens: useSettingsStore.getState().maxTokens,
          },
        });

        childPlaceholders.push({
          id: taskId,
          role: "assistant",
          content: "",
          streamedContent: "",
          isStreaming: true,
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
        get().updateMessage(parentMessageId, {
          workflow: { ...parentMessage.workflow!, status: "error" },
        });
        return;
      }

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
        state.isStreaming = true;

        const workflowService = new WorkflowExecutionService({ getApiKey });
        state.activeWorkflows.set(parentMessageId, workflowService);

        workflowService
          .startWorkflow(parentMessageId, workflowType!, tasks)
          .catch((err) => {
            console.error(`Workflow ${parentMessageId} failed globally:`, err);
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
              const anyStreaming = s.messages.some(
                (m) => m.isStreaming || m.children?.some((c) => c.isStreaming),
              );
              s.isStreaming = anyStreaming;
            });
          })
          .finally(() => {
            set((s) => {
              s.activeWorkflows.delete(parentMessageId);
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
      get().updateMessage(taskId, {
        ...finalChildMessage,
        isStreaming: false,
        streamedContent: undefined,
        error: error instanceof Error ? error.message : error,
      });

      db.messages
        .put({
          id: taskId,
          conversationId: parentMessageId,
          role: "assistant",
          content: finalChildMessage.content,
          createdAt: finalChildMessage.createdAt ?? new Date(),
          providerId: finalChildMessage.providerId,
          modelId: finalChildMessage.modelId,
          tokensInput: finalChildMessage.tokensInput,
          tokensOutput: finalChildMessage.tokensOutput,
        })
        .catch((dbErr) =>
          console.error(`Failed to save child message ${taskId} to DB:`, dbErr),
        );
    },

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
        const errorChildMessage: Message = {
          id: taskId,
          role: "assistant",
          content: "",
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

      workflowEvents.on(WorkflowEvent.TASK_FINISH, handleTaskFinish);
      workflowEvents.on(WorkflowEvent.TASK_ERROR, handleTaskError);

      return () => {
        workflowEvents.off(WorkflowEvent.TASK_FINISH, handleTaskFinish);
        workflowEvents.off(WorkflowEvent.TASK_ERROR, handleTaskError);
      };
    },
  })),
);

export const unsubscribeWorkflowEvents = useCoreChatStore
  .getState()
  ._subscribeToWorkflowEvents();
