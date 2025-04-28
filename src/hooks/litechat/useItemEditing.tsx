// src/hooks/litechat/useItemEditing.tsx
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { SidebarItemType } from "@/types/litechat/chat";
import type { Project } from "@/types/litechat/project";
import type { Conversation } from "@/types/litechat/chat";
import type { SidebarItem } from "@/store/conversation.store";

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

export const useItemEditing = ({
  updateProject,
  updateConversation,
  deleteProject,
}: UseItemEditingProps) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] =
    useState<SidebarItemType | null>(null);
  // Store the original name separately
  const [editingName, setEditingName] = useState<string>("");
  // State for the input field's value
  const [localEditingName, setLocalEditingName] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartEditing = useCallback((item: SidebarItem) => {
    setEditingItemId(item.id);
    setEditingItemType(item.itemType);
    const nameToEdit = item.itemType === "project" ? item.name : item.title;
    setEditingName(nameToEdit); // Store original name
    setLocalEditingName(nameToEdit); // Initialize input value
    setIsSavingEdit(false);
  }, []);

  const resetEditingState = useCallback(() => {
    setEditingItemId(null);
    setEditingItemType(null);
    setEditingName("");
    setLocalEditingName("");
    setIsSavingEdit(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId || !editingItemType || isSavingEdit) return;

    const trimmedLocalName = localEditingName.trim();

    // Prevent saving if name is empty or unchanged
    if (!trimmedLocalName || trimmedLocalName === editingName) {
      if (!trimmedLocalName) {
        toast.error("Name cannot be empty.");
      }
      // If name is unchanged, just cancel editing without saving
      resetEditingState();
      return;
    }

    setIsSavingEdit(true);
    try {
      if (editingItemType === "project") {
        await updateProject(editingItemId, { name: trimmedLocalName });
      } else {
        await updateConversation(editingItemId, { title: trimmedLocalName });
      }
      resetEditingState();
      // Success toast can be added here or handled by the update functions if preferred
      // toast.success("Item updated successfully.");
    } catch (error) {
      // Error toast is likely handled by the update functions, but log here too
      console.error("Failed to save edit:", error);
      // Keep editing state active on error to allow user correction
      setIsSavingEdit(false);
    }
  }, [
    editingItemId,
    editingItemType,
    localEditingName, // Use local state for update
    editingName, // Use original name for comparison
    isSavingEdit,
    updateProject,
    updateConversation,
    resetEditingState,
  ]);

  const handleCancelEdit = useCallback(
    (isNewProject = false) => {
      // If cancelling a "New Project" that hasn't been renamed, delete it
      if (
        isNewProject &&
        editingItemType === "project" &&
        editingName === "New Project" && // Check original name
        editingItemId
      ) {
        deleteProject(editingItemId).catch((err) => {
          console.error("Failed to delete new project on cancel:", err);
          toast.error("Failed to clean up new project.");
        });
      }
      resetEditingState();
    },
    [
      editingItemId,
      editingItemType,
      editingName,
      deleteProject,
      resetEditingState,
    ], // Add editingName dependency
  );

  return {
    editingItemId,
    editingItemType,
    editingName, // Original name
    localEditingName, // Input value
    setLocalEditingName, // Setter for input value
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  };
};
