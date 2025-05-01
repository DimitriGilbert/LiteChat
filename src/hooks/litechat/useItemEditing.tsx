// src/hooks/litechat/useItemEditing.tsx
// Entire file content provided
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { SidebarItem } from "@/store/conversation.store";
import type { Project } from "@/types/litechat/project";
import type { Conversation } from "@/types/litechat/chat";
import type { SidebarItemType } from "@/types/litechat/chat";

interface UseItemEditingProps {
  updateProject: (
    id: string,
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>,
  ) => Promise<void>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string | null) => Project | undefined;
  getConversationById: (id: string | null) => Conversation | undefined;
}

export function useItemEditing({
  updateProject,
  updateConversation,
  deleteProject,
  // getProjectById
}: UseItemEditingProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] =
    useState<SidebarItemType | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [localEditingName, setLocalEditingName] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartEditing = useCallback((item: SidebarItem) => {
    setEditingItemId(item.id);
    setEditingItemType(item.itemType);
    const currentName = item.itemType === "project" ? item.name : item.title;
    setOriginalName(currentName);
    setLocalEditingName(currentName);
    setIsSavingEdit(false);
    // Focus needs to happen in the component via useEffect
  }, []);

  const handleCancelEdit = useCallback(
    (isNewProjectOverride?: boolean) => {
      const currentEditingId = editingItemId;
      const isNewProject =
        isNewProjectOverride ??
        (editingItemType === "project" && originalName === "New Project");

      setEditingItemId(null);
      setEditingItemType(null);
      setOriginalName("");
      setLocalEditingName("");
      setIsSavingEdit(false);

      // If cancelling a "New Project", delete it
      if (isNewProject && currentEditingId) {
        console.log(
          `Cancelling edit for new project ${currentEditingId}, deleting...`,
        );
        deleteProject(currentEditingId).catch((err) => {
          console.error("Failed to delete new project on cancel:", err);
          toast.error("Failed to clean up cancelled new project.");
        });
      }
    },
    [editingItemId, editingItemType, originalName, deleteProject],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId || !editingItemType || isSavingEdit) return;

    const trimmedLocalName = localEditingName.trim();
    const isNewProject =
      editingItemType === "project" && originalName === "New Project";

    // Prevent saving if name is empty
    if (!trimmedLocalName) {
      toast.error("Name cannot be empty.");
      // Optionally refocus the input
      editInputRef.current?.focus();
      return;
    }

    // If the name hasn't changed (and it's not a new project being named), just cancel edit mode
    if (trimmedLocalName === originalName && !isNewProject) {
      handleCancelEdit();
      return;
    }

    setIsSavingEdit(true);
    try {
      if (editingItemType === "project") {
        await updateProject(editingItemId, { name: trimmedLocalName });
      } else {
        await updateConversation(editingItemId, { title: trimmedLocalName });
      }
      toast.success("Item renamed successfully.");
      // Exit edit mode on success
      setEditingItemId(null);
      setEditingItemType(null);
      setOriginalName("");
      setLocalEditingName("");
    } catch (error) {
      console.error("Failed to save item name:", error);
      toast.error(
        `Failed to rename item: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Keep editing mode active on error? Or cancel? Let's cancel for now.
      // handleCancelEdit(isNewProject)
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    editingItemId,
    editingItemType,
    localEditingName,
    originalName,
    isSavingEdit,
    updateProject,
    updateConversation,
    handleCancelEdit,
  ]);

  // Effect to focus input when editing starts
  useEffect(() => {
    if (editingItemId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingItemId]);

  return {
    editingItemId,
    editingItemType,
    originalName,
    localEditingName,
    setLocalEditingName,
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  };
}
