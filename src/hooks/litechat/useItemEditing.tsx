// src/hooks/litechat/useItemEditing.tsx
// FULL FILE
import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { SidebarItem } from "@/store/conversation.store";
import type { Project } from "@/types/litechat/project";
import type { Conversation } from "@/types/litechat/chat";
import type { SidebarItemType } from "@/types/litechat/chat";

interface UseItemEditingProps {
  updateProject: (
    id: string,
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>
  ) => Promise<void>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export function useItemEditing({
  updateProject,
  updateConversation,
  deleteProject,
}: UseItemEditingProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] =
    useState<SidebarItemType | null>(null);
  const [originalNameToCompare, setOriginalNameToCompare] =
    useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleStartEditing = useCallback((item: SidebarItem) => {
    setEditingItemId(item.id);
    setEditingItemType(item.itemType);
    const currentName =
      item.itemType === "project"
        ? (item as Project).name
        : (item as Conversation).title;
    setOriginalNameToCompare(currentName);
    setIsSavingEdit(false);
  }, []);

  const handleCancelEdit = useCallback(
    (isNewProjectOverride?: boolean) => {
      const currentEditingId = editingItemId;
      const isNewProject =
        isNewProjectOverride ??
        (editingItemType === "project" &&
          originalNameToCompare === "New Project");

      setEditingItemId(null);
      setEditingItemType(null);
      setOriginalNameToCompare("");
      setIsSavingEdit(false);

      if (isNewProject && currentEditingId) {
        deleteProject(currentEditingId).catch((err) => {
          console.error("Failed to delete new project on cancel:", err);
          toast.error("Failed to clean up cancelled new project.");
        });
      }
    },
    [editingItemId, editingItemType, originalNameToCompare, deleteProject]
  );

  const handleSaveEdit = useCallback(
    async (
      itemIdToSave: string,
      itemTypeToSave: SidebarItemType,
      newNameFromRenderer?: string
    ) => {
      // Check if the save call is for the currently active editing item
      if (
        itemIdToSave !== editingItemId ||
        itemTypeToSave !== editingItemType ||
        isSavingEdit
      ) {
        // If not, or if already saving, bail.
        // This prevents issues if blur/enter events fire out of order or for a stale edit.
        return;
      }

      const nameToSave = newNameFromRenderer?.trim();

      if (!nameToSave) {
        toast.error("Name cannot be empty.");
        return;
      }

      const isNewProjectBeingNamed =
        itemTypeToSave === "project" && originalNameToCompare === "New Project";

      if (nameToSave === originalNameToCompare && !isNewProjectBeingNamed) {
        handleCancelEdit(); // Name didn't change, treat as cancel
        return;
      }

      setIsSavingEdit(true);
      try {
        if (itemTypeToSave === "project") {
          await updateProject(itemIdToSave, { name: nameToSave });
        } else {
          await updateConversation(itemIdToSave, { title: nameToSave });
        }
        toast.success("Item renamed successfully.");
        // Clear global editing state *after* successful save
        setEditingItemId(null);
        setEditingItemType(null);
        setOriginalNameToCompare("");
      } catch (error) {
        console.error("Failed to save item name:", error);
        toast.error(
          `Failed to rename item: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        setIsSavingEdit(false);
      }
    },
    [
      editingItemId, // Hook's current editingItemId for validation
      editingItemType, // Hook's current editingItemType for validation
      isSavingEdit,
      updateProject,
      updateConversation,
      handleCancelEdit,
      originalNameToCompare,
    ]
  );

  return {
    editingItemId,
    editingItemType,
    isSavingEdit,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
    originalNameToCompare,
  };
}
