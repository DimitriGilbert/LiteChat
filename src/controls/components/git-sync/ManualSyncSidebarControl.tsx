import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GitBranchIcon, RefreshCwIcon, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useShallow } from "zustand/react/shallow";
import { useConversationStore } from "@/store/conversation.store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ManualSyncSidebarControlModule } from "@/controls/modules/ManualSyncSidebarControlModule";

interface ManualSyncSidebarControlProps {
  module: ManualSyncSidebarControlModule;
}

export const ManualSyncSidebarControl: React.FC<ManualSyncSidebarControlProps> = ({ module }) => {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const { syncRepos, repoInitializationStatus } = useConversationStore(
    useShallow((state) => ({
      syncRepos: state.syncRepos,
      repoInitializationStatus: state.repoInitializationStatus,
    }))
  );

  const handleSyncAll = () => {
    module.syncAllRepos();
  };

  const handleSyncRepo = (repoId: string) => {
    module.syncRepo(repoId);
  };

  const isSyncing = module.isSyncing;
  const hasSyncRepos = syncRepos.length > 0;
  const anyRepoSyncing = Object.values(repoInitializationStatus).some(status => status === "syncing");

  return (
    <TooltipProvider delayDuration={100}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!hasSyncRepos}
                aria-label="Manual Git Sync"
              >
                {(isSyncing || anyRepoSyncing) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranchIcon className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {!hasSyncRepos ? "No sync repositories configured" : "Manual Git Sync"}
          </TooltipContent>
        </Tooltip>
        
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Git Sync Repositories</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={!hasSyncRepos || isSyncing || anyRepoSyncing}
                className="h-8"
              >
                {(isSyncing || anyRepoSyncing) ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCwIcon className="h-3 w-3 mr-1" />
                )}
                Sync All
              </Button>
            </div>
            
            {!hasSyncRepos ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sync repositories configured. Go to Settings → Git → Sync Repositories to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {syncRepos.map((repo) => {
                  const status = repoInitializationStatus[repo.id] || "idle";
                  const isRepoSyncing = status === "syncing";
                  
                  return (
                    <div
                      key={repo.id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg",
                        "bg-card hover:bg-muted/50 transition-colors"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {repo.name}
                          </span>
                          <Badge 
                            variant={
                              status === "idle" ? "secondary" :
                              status === "syncing" ? "default" :
                              status === "error" ? "destructive" :
                              "outline"
                            }
                            className="text-xs"
                          >
                            {status === "idle" ? "Ready" :
                             status === "syncing" ? "Syncing" :
                             status === "error" ? "Error" :
                             "Unknown"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {repo.branch || "main"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncRepo(repo.id)}
                        disabled={isRepoSyncing || isSyncing}
                        className="h-8 w-8 p-0"
                      >
                        {isRepoSyncing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCwIcon className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}; 