import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
// Removed unused useSidebarStore import
// import { useSidebarStore } from "@/store/sidebar.store"; // Assuming getProject is here
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GitBranchIcon } from "lucide-react";
import { toast } from "sonner";

export interface ProjectGitConfigProps {
  projectId: string;
}

export const ProjectGitConfig: React.FC<ProjectGitConfigProps> = ({
  projectId,
}) => {
  // Wrap placeholder functions in useCallback
  const getProject = useCallback(async (id: string) => {
    console.warn("getProject not implemented in store", id);
    return undefined;
  }, []); // Empty dependency array as it's a placeholder

  const updateProject = useCallback(async (id: string, data: any) => {
    console.warn("updateProject not implemented in store", id, data);
  }, []); // Empty dependency array as it's a placeholder

  const [gitEnabled, setGitEnabled] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitRepoBranch, setGitRepoBranch] = useState("main");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load project git configuration
  useEffect(() => {
    const loadProjectConfig = async () => {
      if (projectId) {
        setIsLoading(true);
        try {
          // Use store action/selector
          const project = await getProject(projectId); // Now uses useCallback version
          if (project) {
            // Assuming these fields exist on the project object in the store
            // setGitEnabled(!!project.gitRepoEnabled);
            // setGitRepoUrl(project.gitRepoUrl || '');
            // setGitRepoBranch(project.gitRepoBranch || 'main');
            console.warn("Project git config loading not fully implemented");
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
  }, [projectId, getProject]); // getProject is now stable

  // Save project git configuration
  const handleSaveConfig = async () => {
    if (!gitRepoUrl && gitEnabled) {
      toast.error("Please enter a repository URL");
      return;
    }

    setIsSaving(true);
    try {
      // Use store action
      await updateProject(projectId, {
        // Now uses useCallback version
        gitRepoEnabled: gitEnabled,
        gitRepoUrl: gitRepoUrl,
        gitRepoBranch: gitRepoBranch || "main",
      });
      toast.success("Project git configuration saved");
    } catch (error) {
      console.error("Failed to save git configuration:", error);
      toast.error("Failed to save git configuration");
    } finally {
      setIsSaving(false);
    }
  };

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
                disabled={!gitEnabled}
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
              disabled={!gitEnabled}
            />
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSaveConfig}
              disabled={!gitEnabled || isSaving || !gitRepoUrl}
              className="w-full"
            >
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              This configuration will automatically sync all conversations in
              this project with the specified git repository.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
