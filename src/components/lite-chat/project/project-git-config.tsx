import React, { useState, useEffect } from 'react';
import { useChatContext } from '@/hooks/use-chat-context';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GitBranchIcon } from 'lucide-react';
import { toast } from 'sonner';

export interface ProjectGitConfigProps {
  projectId: string;
}

export const ProjectGitConfig: React.FC<ProjectGitConfigProps> = ({ projectId }) => {
  const { getProject } = useChatContext();
  
  const [gitEnabled, setGitEnabled] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitRepoBranch, setGitRepoBranch] = useState('main');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load project git configuration
  useEffect(() => {
    const loadProjectConfig = async () => {
      if (projectId) {
        setIsLoading(true);
        try {
          const project = await getProject(projectId);
          if (project) {
            setGitEnabled(!!project.gitRepoEnabled);
            setGitRepoUrl(project.gitRepoUrl || '');
            setGitRepoBranch(project.gitRepoBranch || 'main');
          }
        } catch (error) {
          console.error('Failed to load project configuration:', error);
          toast.error('Failed to load project configuration');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadProjectConfig();
  }, [projectId, getProject]);
  
  // Save project git configuration
  const handleSaveConfig = async () => {
    if (!gitRepoUrl && gitEnabled) {
      toast.error('Please enter a repository URL');
      return;
    }
    
    setIsSaving(true);
    try {
      // In a real implementation, this would update the project in the database
      // This is a placeholder as the actual implementation would depend on your storage layer
      // Example:
      // await updateProject(projectId, {
      //   gitRepoEnabled: gitEnabled,
      //   gitRepoUrl: gitRepoUrl,
      //   gitRepoBranch: gitRepoBranch || 'main'
      // });
      
      // For now, just show a success message
      toast.success('Project git configuration saved');
    } catch (error) {
      console.error('Failed to save git configuration:', error);
      toast.error('Failed to save git configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return <div className="p-4 text-center">Loading project configuration...</div>;
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
            {gitEnabled ? 'Enabled' : 'Disabled'}
          </Label>
        </div>
      </div>
      
      <div className={gitEnabled ? '' : 'opacity-50 pointer-events-none'}>
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
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              This configuration will automatically sync all conversations in this project with the specified git repository.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};