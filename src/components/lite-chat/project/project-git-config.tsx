
import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GitBranchIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import type { DbProject } from "@/lib/types";

export interface ProjectGitConfigProps {
  projectId: string;
}

export const ProjectGitConfig: React.FC<ProjectGitConfigProps> = ({
  projectId,
}) => {
  const [gitEnabled, setGitEnabled] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitRepoBranch, setGitRepoBranch] = useState("main");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    const loadProjectConfig = async () => {
      if (projectId) {
        setIsLoading(true);
        try {
          const project = await db.projects.get(projectId);
          if (project) {
            setGitEnabled(!!project.gitRepoEnabled);
            setGitRepoUrl(project.gitRepoUrl || "");
            setGitRepoBranch(project.gitRepoBranch || "main");
          } else {
            toast.error("Project not found.");
          }
        } catch (error) {
          console.error("Failed to load project configuration:", error);
          toast.error("Failed to load project configuration");
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadProjectConfig();
  }, [projectId]);
  const handleSaveConfig = useCallback(async () => {
    if (!gitRepoUrl && gitEnabled) {
      toast.error("Please enter a repository URL");
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Partial<DbProject> = {
        gitRepoEnabled: gitEnabled,
        gitRepoUrl: gitEnabled ? gitRepoUrl : null,
        gitRepoBranch: gitEnabled ? gitRepoBranch || "main" : null,
        updatedAt: new Date(),
      };
      await db.projects.update(projectId, updateData);
      toast.success("Project git configuration saved");
    } catch (error) {
      console.error("Failed to save git configuration:", error);
      toast.error("Failed to save git configuration");
    } finally {
      setIsSaving(false);
    }
  }, [projectId, gitEnabled, gitRepoUrl, gitRepoBranch]);

  if (isLoading) {
    return (
      <div className="p-4 text-center">Loading project configuration...</div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Project Git Repository</h3>
        <div className="flex items-center space-x-2">
          <Switch
            id="project-git-enabled"
            checked={gitEnabled}
            onCheckedChange={setGitEnabled}
            disabled={isSaving}
          />
          <Label htmlFor="project-git-enabled" className="cursor-pointer">
            {gitEnabled ? "Enabled" : "Disabled"}
          </Label>
        </div>
      </div>

      <div className={gitEnabled ? "" : "opacity-50 pointer-events-none"}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-git-repo-url">Repository URL</Label>
            <div className="flex items-center gap-2">
              <GitBranchIcon className="h-4 w-4 text-gray-500" />
              <Input
                id="project-git-repo-url"
                placeholder="https://github.com/username/repo.git"
                value={gitRepoUrl}
                onChange={(e) => setGitRepoUrl(e.target.value)}
                disabled={!gitEnabled || isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-git-repo-branch">Branch</Label>
            <Input
              id="project-git-repo-branch"
              placeholder="main"
              value={gitRepoBranch}
              onChange={(e) => setGitRepoBranch(e.target.value)}
              disabled={!gitEnabled || isSaving}
            />
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSaveConfig}
              disabled={!gitEnabled || isSaving || !gitRepoUrl}
              className="w-full"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              This configuration will automatically sync all conversations in
              this project with the specified git repository. (Feature WIP)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
