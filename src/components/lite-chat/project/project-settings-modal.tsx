import React, { useState } from 'react';
import { useChatContext } from '@/hooks/use-chat-context';
import { ProjectGitConfig } from './project-git-config';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  const { getProject } = useChatContext();
  const [projectName, setProjectName] = useState('');

  // Load project details when modal opens
  React.useEffect(() => {
    if (open && projectId) {
      getProject(projectId).then((project) => {
        if (project) {
          setProjectName(project.name);
        }
      });
    }
  }, [open, projectId, getProject]);

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