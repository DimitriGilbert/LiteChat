import React, { useState, useEffect } from 'react';
import { useChatContext } from '@/hooks/use-chat-context';
import { useGit } from '@/hooks/use-git';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import { RefreshCwIcon, GitBranchIcon, GitCommitIcon, GitPullRequestIcon, FolderOpenIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const GitManager: React.FC<{ className?: string }> = ({ className }) => {
  const { vfs } = useChatContext();
  const git = useGit(vfs);
  
  const [currentPath] = useState('/');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState('LiteChat User');
  const [authorEmail, setAuthorEmail] = useState('user@example.com');
  const [isRepo, setIsRepo] = useState(false);
  const [repoInfo, setRepoInfo] = useState<any>(null);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [isAdvancedVisible, setIsAdvancedVisible] = useState(false);
  
  // Check if current directory is a git repo when path changes
  useEffect(() => {
    const checkIfRepo = async () => {
      if (git.initialized && currentPath) {
        const isGitRepo = await git.isGitRepository(currentPath);
        setIsRepo(isGitRepo);
        
        if (isGitRepo) {
          const info = await git.getRepoInfo(currentPath);
          if (info.success && info.data) {
            setRepoInfo(info.data);
          }
        } else {
          setRepoInfo(null);
        }
      }
    };
    
    checkIfRepo();
  }, [git, currentPath, git.initialized]);
  
  // Clone a repository
  const handleClone = async () => {
    if (!repoUrl) {
      toast.error('Please enter a repository URL');
      return;
    }
    
    const result = await git.cloneRepository(repoUrl, currentPath, { branch });
    if (result.success) {
      setShowCloneForm(false);
      setRepoUrl('');
      // Force refresh the file manager
      if (vfs && vfs.listFiles) {
        await vfs.listFiles(currentPath);
      }
    }
  };
  
  // Initialize a new repository
  const handleInit = async () => {
    const result = await git.initRepository(currentPath);
    if (result.success) {
      setIsRepo(true);
    }
  };
  
  // Commit changes
  const handleCommit = async () => {
    if (!commitMessage) {
      toast.error('Please enter a commit message');
      return;
    }
    
    // First add all files
    await git.addFile(currentPath, '.');
    
    // Then commit
    const result = await git.commitChanges(currentPath, {
      message: commitMessage,
      author: {
        name: authorName,
        email: authorEmail
      }
    });
    
    if (result.success) {
      setCommitMessage('');
      // Refresh repo info
      const info = await git.getRepoInfo(currentPath);
      if (info.success && info.data) {
        setRepoInfo(info.data);
      }
    }
  };
  
  // Pull changes
  const handlePull = async () => {
    const result = await git.pullChanges(currentPath);
    if (result.success) {
      // Force refresh the file manager
      if (vfs && vfs.listFiles) {
        await vfs.listFiles(currentPath);
      }
      // Refresh repo info
      const info = await git.getRepoInfo(currentPath);
      if (info.success && info.data) {
        setRepoInfo(info.data);
      }
    }
  };
  
  // Push changes
  const handlePush = async () => {
    await git.pushChanges(currentPath);
  };
  
  // Refresh repository info
  const handleRefreshInfo = async () => {
    if (isRepo) {
      const info = await git.getRepoInfo(currentPath);
      if (info.success && info.data) {
        setRepoInfo(info.data);
      }
    }
  };
  
  const toggleAdvancedSettings = () => {
    setIsAdvancedVisible(!isAdvancedVisible);
  };
  
  // If VFS is not ready
  if (!vfs || !vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Virtual Filesystem not available or not enabled for this item.
      </div>
    );
  }
  
  if (git.loading) {
    return (
      <div className={cn("p-4 space-y-2", className)}>
        <Skeleton className="h-8 w-1/2 bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
      </div>
    );
  }
  
  return (
    <div className={cn("flex flex-col p-4 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Git Repository</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshInfo}
            disabled={!isRepo}
          >
            <RefreshCwIcon className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
      
      {!isRepo ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowCloneForm(!showCloneForm)}
              variant="secondary"
            >
              <GitBranchIcon className="h-4 w-4 mr-1" />
              Clone Repository
            </Button>
            <Button 
              onClick={handleInit}
              variant="secondary"
            >
              <FolderOpenIcon className="h-4 w-4 mr-1" />
              Initialize Repository
            </Button>
          </div>
          
          {showCloneForm && (
            <div className="border rounded-md p-4 space-y-3">
              <h4 className="font-medium">Clone Repository</h4>
              <div className="space-y-2">
                <Label htmlFor="repo-url">Repository URL</Label>
                <Input
                  id="repo-url"
                  placeholder="https://github.com/username/repo.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleClone} disabled={!repoUrl}>
                  Clone
                </Button>
                <Button variant="outline" onClick={() => setShowCloneForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Repository Info */}
          <div className="border rounded-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <GitBranchIcon className="h-4 w-4" />
              <span className="font-medium">Branch:</span>
              <span>{repoInfo?.branch || 'Unknown'}</span>
            </div>
            
            {repoInfo?.url && repoInfo.url !== 'No remote configured' && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Remote:</span>
                <span className="text-sm truncate max-w-xs">{repoInfo.url}</span>
              </div>
            )}
            
            {repoInfo?.lastCommit && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <GitCommitIcon className="h-4 w-4" />
                  <span className="font-medium">Last Commit:</span>
                </div>
                <div className="text-sm pl-6 truncate">{repoInfo.lastCommit.message}</div>
                <div className="text-xs text-gray-400 pl-6">
                  {repoInfo.lastCommit.author.name} • {new Date(repoInfo.lastCommit.date).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          
          {/* Git Actions */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handlePull} variant="secondary">
                <GitBranchIcon className="h-4 w-4 mr-1" />
                Pull
              </Button>
              <Button onClick={handlePush} variant="secondary">
                <GitPullRequestIcon className="h-4 w-4 mr-1" />
                Push
              </Button>
            </div>
            
            <Separator />
            
            {/* Commit Section */}
            <div className="space-y-3">
              <h4 className="font-medium">Commit Changes</h4>
              <div className="space-y-2">
                <Label htmlFor="commit-message">Commit Message</Label>
                <Input
                  id="commit-message"
                  placeholder="Describe your changes"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>
              
              <Button onClick={toggleAdvancedSettings} variant="ghost" size="sm">
                {isAdvancedVisible ? 'Hide' : 'Show'} Advanced Settings
              </Button>
              
              {isAdvancedVisible && (
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="author-name">Author Name</Label>
                    <Input
                      id="author-name"
                      placeholder="Your Name"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author-email">Author Email</Label>
                    <Input
                      id="author-email"
                      placeholder="your.email@example.com"
                      value={authorEmail}
                      onChange={(e) => setAuthorEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleCommit} 
                disabled={!commitMessage}
                className="w-full"
              >
                <GitCommitIcon className="h-4 w-4 mr-1" />
                Commit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};