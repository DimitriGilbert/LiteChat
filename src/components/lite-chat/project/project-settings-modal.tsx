// src/components/lite-chat/project/project-settings-modal.tsx
import React, { useState, useEffect } from "react"; // Added useEffect
// Import necessary store hooks
import { useSidebarStore } from "@/store/sidebar.store"; // Assuming getProject is here
import { ProjectGitConfig } from "./project-git-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { DbProject } from "@/lib/types"; // Import DbProject

export interface ProjectSettingsModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  projectId,
  open,
  onOpenChange,
}) => {
  // Get function to read state directly when needed
  const getSidebarState = useSidebarStore.getState;

  const [projectName, setProjectName] = useState("");

  // Load project details when modal opens
  useEffect(() => {
    if (open && projectId) {
      // Get current projects directly from store state inside the effect
      const currentProjects = getSidebarState().dbProjects;
      const project = currentProjects.find(
        (p: DbProject) => p.id === projectId,
      );
      if (project) {
        setProjectName(project.name);
      } else {
        console.warn(`Project ${projectId} not found in store state.`);
        setProjectName("Unknown Project");
      }
    }
  }, [open, projectId, getSidebarState]); // Depend on IDs and getState

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Project Settings: {projectName}</DialogTitle>
          <DialogDescription>
            Configure settings for this project and all its conversations.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="git" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="git">Git Repository</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="git" className="space-y-4">
            <ProjectGitConfig projectId={projectId} />
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                General project settings will be implemented in the future.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
