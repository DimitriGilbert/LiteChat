// src/components/lite-chat/project/project-settings-modal.tsx
import React, { useState, useEffect } from "react";
import { ProjectGitConfig } from "./project-git-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { DbProject } from "@/lib/types";
import { db } from "@/lib/db"; // Import db instance
import { toast } from "sonner"; // Import toast

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
  const [projectName, setProjectName] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);

  // Load project details when modal opens or projectId changes
  useEffect(() => {
    const loadProject = async () => {
      if (open && projectId) {
        setIsLoading(true);
        try {
          const project = await db.projects.get(projectId); // Use Dexie
          if (project) {
            setProjectName(project.name);
          } else {
            setProjectName("Unknown Project");
            toast.error("Could not load project details.");
            console.warn(`Project ${projectId} not found in DB.`);
          }
        } catch (error) {
          setProjectName("Error Loading");
          toast.error("Failed to load project details.");
          console.error("Failed to load project:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (!open) {
        // Reset when closed
        setProjectName("Loading...");
        setIsLoading(true);
      }
    };

    loadProject();
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Project Settings: {isLoading ? "Loading..." : projectName}
          </DialogTitle>
          <DialogDescription>
            Configure settings for this project and all its conversations.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="git" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="git" disabled={isLoading}>
              Git Repository
            </TabsTrigger>
            <TabsTrigger value="general" disabled={isLoading}>
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="git" className="space-y-4">
            {isLoading ? (
              <div className="p-4 text-center">Loading...</div>
            ) : (
              <ProjectGitConfig projectId={projectId} />
            )}
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
