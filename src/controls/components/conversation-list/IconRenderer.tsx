// src/controls/components/conversation-list/IconRenderer.tsx
// FULL FILE
import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, FolderPlusIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useShallow } from "zustand/react/shallow";
import type { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule"; // Import module type
import { toast } from "sonner";

interface ConversationListIconRendererProps {
  module: ConversationListControlModule;
}

export const ConversationListIconRenderer: React.FC<
  ConversationListIconRendererProps
> = ({ module }) => {
  const { addConversation, selectItem, selectedItemId, selectedItemType } =
    useConversationStore(
      useShallow((state) => ({
        addConversation: state.addConversation,
        selectItem: state.selectItem,
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        getConversationById: state.getConversationById,
      }))
    );
  const { addProject } = useProjectStore(
    useShallow((state) => ({
      addProject: state.addProject,
    }))
  );

  const getParentProjectId = useCallback(() => {
    if (selectedItemType === "project") {
      return selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = useConversationStore
        .getState()
        .getConversationById(selectedItemId);
      return convo?.projectId ?? null;
    }
    return null;
  }, [selectedItemId, selectedItemType]);

  const handleNewChat = async () => {
    module.setIsLoading(true);
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addConversation({
        title: "New Chat",
        projectId: parentProjectId,
      });
      selectItem(newId, "conversation");
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Failed to create new chat.");
    } finally {
      module.setIsLoading(false);
    }
  };

  const handleNewProject = async () => {
    module.setIsLoading(true);
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: "New Project",
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      // Note: Starting edit mode from here is complex due to module separation.
      // The main list component handles starting edit for new projects.
    } catch (error) {
      console.error("Failed to create new project:", error);
      toast.error("Failed to create new project.");
    } finally {
      module.setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewProject}
              className="h-8 w-8"
              aria-label="New Project"
              disabled={module.isLoading}
            >
              <FolderPlusIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New Project</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              className="h-8 w-8"
              aria-label="New Chat"
              disabled={module.isLoading}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New Chat</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
