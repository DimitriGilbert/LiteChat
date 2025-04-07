// src/hooks/use-conversation-management.ts
import { useState, useCallback } from "react";
import { useChatStorage } from "./use-chat-storage";
import type { DbConversation } from "@/lib/types";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { z } from "zod";

const messageImportSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((dateStr) => new Date(dateStr)),
});
const conversationImportSchema = z.array(messageImportSchema);

interface UseConversationManagementProps {
  initialConversationId?: string | null;
  onConversationSelect: (id: string | null) => void; // Callback when selection changes
}

interface UseConversationManagementReturn {
  conversations: DbConversation[];
  selectedConversationId: string | null;
  selectConversation: (id: string | null) => Promise<void>; // Make async for consistency
  createConversation: (
    title?: string,
    initialSystemPrompt?: string | null,
  ) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  activeConversationData: DbConversation | null;
}

export function useConversationManagement({
  initialConversationId = null,
  onConversationSelect,
}: UseConversationManagementProps): UseConversationManagementReturn {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId);
  const [activeConversationData, setActiveConversationData] =
    useState<DbConversation | null>(null);

  // Use storage hook primarily for conversation list and DB actions
  const {
    conversations,
    createConversation: createDbConversation,
    deleteConversation: deleteDbConversation,
    renameConversation: renameDbConversation,
    updateConversationSystemPrompt: updateDbConversationSystemPrompt,
    addDbMessage, // Needed for import
  } = useChatStorage(selectedConversationId); // Keep ID for potential filtering if needed

  const selectConversation = useCallback(
    async (id: string | null) => {
      setSelectedConversationId(id);
      onConversationSelect(id); // Notify parent/context
      if (id) {
        try {
          const convoData = await db.conversations.get(id);
          setActiveConversationData(convoData ?? null);
        } catch (err) {
          console.error("Failed to load conversation data:", err);
          setActiveConversationData(null);
          toast.error("Failed to load conversation details.");
        }
      } else {
        setActiveConversationData(null);
      }
    },
    [onConversationSelect],
  );

  const createConversation = useCallback(
    async (
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      const newId = await createDbConversation(title, initialSystemPrompt);
      await selectConversation(newId); // Select the new conversation
      return newId;
    },
    [createDbConversation, selectConversation],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      const currentSelectedId = selectedConversationId;
      await deleteDbConversation(id);
      if (currentSelectedId === id) {
        // Select the next available conversation or null
        const remainingConversations = await db.conversations
          .orderBy("updatedAt")
          .reverse()
          .toArray();
        await selectConversation(remainingConversations[0]?.id ?? null);
      }
      // No need to manually refresh 'conversations' due to useLiveQuery
    },
    [deleteDbConversation, selectedConversationId, selectConversation],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      await renameDbConversation(id, newTitle);
      if (id === selectedConversationId) {
        // Refresh active data if it's the current one
        const updatedConvoData = await db.conversations.get(id);
        setActiveConversationData(updatedConvoData ?? null);
      }
      // No need to manually refresh 'conversations' due to useLiveQuery
    },
    [renameDbConversation, selectedConversationId],
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      await updateDbConversationSystemPrompt(id, systemPrompt);
      if (id === selectedConversationId) {
        const updatedConvoData = await db.conversations.get(id);
        setActiveConversationData(updatedConvoData ?? null);
      }
    },
    [updateDbConversationSystemPrompt, selectedConversationId],
  );

  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        const conversation = await db.conversations.get(conversationId);
        const messagesToExport = await db.messages
          .where("conversationId")
          .equals(conversationId)
          .sortBy("createdAt");

        if (!conversation || messagesToExport.length === 0) {
          toast.warning("Cannot export empty or non-existent conversation.");
          return;
        }

        // Exclude conversationId from exported messages
        const exportData = messagesToExport.map(
          ({ conversationId: _, ...msg }) => msg,
        );

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const filename = `${conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${conversationId.substring(0, 6)}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Conversation "${conversation.title}" exported.`);
      } catch (err: any) {
        console.error("Export failed:", err);
        toast.error(`Export failed: ${err.message}`);
      }
    },
    [],
  );

  const importConversation = useCallback(
    async (file: File) => {
      if (!file || file.type !== "application/json") {
        toast.error("Please select a valid JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const parsedData = JSON.parse(jsonString);

          // Validate the structure of the imported data
          const validationResult =
            conversationImportSchema.safeParse(parsedData);
          if (!validationResult.success) {
            console.error("Import validation error:", validationResult.error);
            toast.error(
              `Import failed: Invalid file format. ${validationResult.error.errors[0]?.message || ""}`,
            );
            return;
          }

          const importedMessages = validationResult.data;

          if (importedMessages.length === 0) {
            toast.warning("Imported file contains no messages.");
            return;
          }

          // Create a new conversation for the imported messages
          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "")}`;
          const newConversationId =
            await createDbConversation(newConversationTitle);

          // Add messages to the new conversation
          await db.messages.bulkAdd(
            importedMessages.map((msg) => ({
              ...msg,
              conversationId: newConversationId,
            })),
          );
          // Update the new conversation's timestamp
          await db.conversations.update(newConversationId, {
            updatedAt: new Date(),
          });

          await selectConversation(newConversationId); // Select the newly imported chat
          toast.success(
            `Conversation imported successfully as "${newConversationTitle}"!`,
          );
        } catch (err: any) {
          console.error("Import failed:", err);
          toast.error(
            `Import failed: ${err.message || "Could not read or parse file."}`,
          );
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read the file.");
      };
      reader.readAsText(file);
    },
    [createDbConversation, addDbMessage, selectConversation], // addDbMessage might not be strictly needed if bulkAdd works
  );

  const exportAllConversations = useCallback(async () => {
    try {
      const allConversations = await db.conversations.toArray();
      if (allConversations.length === 0) {
        toast.info("No conversations to export.");
        return;
      }

      const exportData = [];
      for (const conversation of allConversations) {
        const messages = await db.messages
          .where("conversationId")
          .equals(conversation.id)
          .sortBy("createdAt");
        exportData.push({
          // Include conversation metadata in the export
          id: conversation.id,
          title: conversation.title,
          systemPrompt: conversation.systemPrompt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: messages.map(({ conversationId: _, ...msg }) => msg), // Exclude redundant convoId
        });
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `litechat_all_export_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`All ${allConversations.length} conversations exported.`);
    } catch (err: any) {
      console.error("Export All failed:", err);
      toast.error(`Export All failed: ${err.message}`);
    }
  }, []);

  return {
    conversations: conversations || [], // Ensure it's always an array
    selectedConversationId,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationSystemPrompt,
    exportConversation,
    importConversation,
    exportAllConversations,
    activeConversationData,
  };
}
