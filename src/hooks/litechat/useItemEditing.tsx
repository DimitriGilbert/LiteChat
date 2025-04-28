// src/hooks/litechat/useItemEditing.tsx
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { SidebarItemType } from "@/types/litechat/chat";
import { SidebarItem } from "@/store/conversation.store";

interface UseItemEditingProps {
  updateProject: (id: string, data: { name: string }) => Promise<void>;
  updateConversation: (id: string, data: { title: string }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string) => any;
  getConversationById: (id: string) => any;
}

export const useItemEditing = ({
  updateProject,
  updateConversation,
  deleteProject,
  getProjectById,
  getConversationById,
}: UseItemEditingProps) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] =
    useState<SidebarItemType | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartEditing = useCallback((item: SidebarItem) => {
    setEditingItemId(item.id);
    setEditingItemType(item.itemType);
    setEditingName(item.itemType === "project" ? item.name : item.title);
    setIsSavingEdit(false);
  }, []);

  const handleCancelEdit = useCallback(
    (isNewProject = false) => {
      const currentEditingId = editingItemId;
      setEditingItemId(null);
      setEditingItemType(null);
      setEditingName("");
      setIsSavingEdit(false);

      // If cancelling edit of a "New Project", delete it
      if (isNewProject && currentEditingId) {
        toast.info("Cancelled creating empty project.");
        deleteProject(currentEditingId).catch((err) => {
          console.error("Failed to delete cancelled new project", err);
          toast.error("Failed to clean up cancelled project.");
        });
      }
    },
    [editingItemId, deleteProject],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId || !editingItemType || !editingName.trim()) {
      handleCancelEdit();
      return;
    }

    const originalItem =
      editingItemType === "project"
        ? getProjectById(editingItemId)
        : getConversationById(editingItemId);

    const originalName =
      editingItemType === "project" ? originalItem?.name : originalItem?.title;

    if (originalName === editingName.trim()) {
      handleCancelEdit();
      return;
    }

    setIsSavingEdit(true);
    try {
      if (editingItemType === "project") {
        await updateProject(editingItemId, { name: editingName.trim() });
      } else {
        await updateConversation(editingItemId, { title: editingName.trim() });
      }
      handleCancelEdit();
    } catch (error) {
      console.error("Failed to save edit:", error);
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    editingItemId,
    editingItemType,
    editingName,
    updateProject,
    updateConversation,
    handleCancelEdit,
    getProjectById,
    getConversationById,
  ]);

  return {
    editingItemId,
    editingItemType,
    editingName,
    setEditingName,
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  };
};
