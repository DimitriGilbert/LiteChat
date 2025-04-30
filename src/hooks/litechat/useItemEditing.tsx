// src/hooks/litechat/useItemEditing.tsx
// NEW FILE
import { useState, useCallback, useRef } from "react";
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
  deleteProject: (id: string) => Promise<void>; // Needed for cancelling new projects
  getProjectById: (id: string | null) => Project | undefined;
  getConversationById: (id: string | null) => Conversation | undefined;
}

export function useItemEditing({
  updateProject,
  updateConversation,
  deleteProject,
}: UseItemEditingProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] =
    useState<SidebarItemType | null>(null);
  const [editingName, setEditingName] = useState<string>(""); // Original name for comparison/display
  const [localEditingName, setLocalEditingName] = useState<string>(""); // Input field value
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartEditing = useCallback((item: SidebarItem) => {
    setEditingItemId(item.id);
    setEditingItemType(item.itemType);
    const currentName = item.itemType === "project" ? item.name : item.title;
    setEditingName(currentName); // Store original name
    setLocalEditingName(currentName); // Initialize local state
    setIsSavingEdit(false);
  }, []);

  const handleCancelEdit = useCallback(
    (isNewProject: boolean = false) => {
      const currentEditingId = editingItemId; // Capture before resetting
      setEditingItemId(null);
      setEditingItemType(null);
      setEditingName("");
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
    [editingItemId, deleteProject], // Add deleteProject dependency
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId || !editingItemType || isSavingEdit) return;

    const trimmedLocalName = localEditingName.trim();

    // Prevent saving if name is empty or unchanged
    if (!trimmedLocalName || trimmedLocalName === editingName) {
      handleCancelEdit(
        editingItemType === "project" && editingName === "New Project",
      ); // Cancel instead of saving
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
      setEditingItemId(null); // Exit edit mode on success
      setEditingItemType(null);
      setEditingName("");
      setLocalEditingName("");
    } catch (error) {
      console.error("Failed to save item name:", error);
      // Error toast is likely handled by the store actions, but maybe add a generic one here?
      // toast.error("Failed to rename item.");
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    editingItemId,
    editingItemType,
    localEditingName, // Use local state for saving
    editingName, // Use original name for comparison
    isSavingEdit,
    updateProject,
    updateConversation,
    handleCancelEdit,
  ]);

  return {
    editingItemId,
    editingItemType,
    editingName, // Original name
    localEditingName, // Local state for input
    setLocalEditingName, // Setter for local state
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  };
}
