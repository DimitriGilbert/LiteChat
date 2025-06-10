import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranchIcon, 
  StopCircleIcon, 
  RefreshCwIcon,
  AlertCircleIcon,
  DownloadIcon,
  Upload
} from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { syncEvent } from "@/types/litechat/events/sync.events";
import type { BulkSyncProgress } from "@/services/bulk-sync.service";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BulkSyncControlProps {
  onSyncAll: () => Promise<void>;
  onSyncPending: () => Promise<void>;
  onInitializeRepos: () => Promise<void>;
  onAbortSync: () => Promise<void>;
  isRunning?: boolean;
  totalRepos: number;
  totalConversations: number;
  pendingConversations: number;
}

export const BulkSyncControl: React.FC<BulkSyncControlProps> = ({
  onSyncAll,
  onSyncPending,
  onInitializeRepos,
  onAbortSync,
  isRunning = false,
  totalRepos,
  totalConversations,
  pendingConversations,
}) => {
  const [progress, setProgress] = useState<BulkSyncProgress | null>(null);
  const [isLocallyRunning, setIsLocallyRunning] = useState(false);

  useEffect(() => {
    const handleBulkSyncStarted = (payload: any) => {
      if (payload && payload.progress) {
        setProgress(payload.progress);
        setIsLocallyRunning(true);
      }
    };

    const handleBulkSyncProgress = (payload: any) => {
      if (payload && payload.progress) {
        setProgress(payload.progress);
      }
    };

    const handleBulkSyncCompleted = (payload: any) => {
      if (payload && payload.progress) {
        setProgress(payload.progress);
        setTimeout(() => {
          setProgress(null);
          setIsLocallyRunning(false);
        }, 2000); // Show final state for 2 seconds
      }
    };

    const handleBulkSyncFailed = (payload: any) => {
      if (payload && payload.progress) {
        setProgress(payload.progress);
        setTimeout(() => {
          setProgress(null);
          setIsLocallyRunning(false);
        }, 5000); // Show error state for 5 seconds
      }
    };

    emitter.on(syncEvent.bulkSyncStarted, handleBulkSyncStarted);
    emitter.on(syncEvent.bulkSyncProgress, handleBulkSyncProgress);
    emitter.on(syncEvent.bulkSyncCompleted, handleBulkSyncCompleted);
    emitter.on(syncEvent.bulkSyncFailed, handleBulkSyncFailed);

    return () => {
      emitter.off(syncEvent.bulkSyncStarted, handleBulkSyncStarted);
      emitter.off(syncEvent.bulkSyncProgress, handleBulkSyncProgress);
      emitter.off(syncEvent.bulkSyncCompleted, handleBulkSyncCompleted);
      emitter.off(syncEvent.bulkSyncFailed, handleBulkSyncFailed);
    };
  }, []);

  const isSyncing = isRunning || isLocallyRunning;
  const totalRepoProgress = progress ? (progress.completedRepos / Math.max(progress.totalRepos, 1)) * 100 : 0;
  const totalConvProgress = progress ? (progress.completedConversations / Math.max(progress.totalConversations, 1)) * 100 : 0;

  const handleSyncAll = async () => {
    setIsLocallyRunning(true);
    try {
      await onSyncAll();
    } catch (error) {
      console.error("Sync all failed:", error);
      setIsLocallyRunning(false);
    }
  };

  const handleSyncPending = async () => {
    setIsLocallyRunning(true);
    try {
      await onSyncPending();
    } catch (error) {
      console.error("Sync pending failed:", error);
      setIsLocallyRunning(false);
    }
  };

  const handleInitializeRepos = async () => {
    setIsLocallyRunning(true);
    try {
      await onInitializeRepos();
    } catch (error) {
      console.error("Initialize repos failed:", error);
      setIsLocallyRunning(false);
    }
  };

  const handleAbort = async () => {
    try {
      await onAbortSync();
    } catch (error) {
      console.error("Abort sync failed:", error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5" />
          Bulk Git Sync
        </CardTitle>
        <CardDescription>
          Manage synchronization across all repositories and conversations
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium text-lg">{totalRepos}</div>
            <div className="text-muted-foreground">Repositories</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-lg">{totalConversations}</div>
            <div className="text-muted-foreground">Total Conversations</div>
          </div>
          <div className="text-center">
            <div className={cn(
              "font-medium text-lg",
              pendingConversations > 0 ? "text-orange-600" : "text-green-600"
            )}>
              {pendingConversations}
            </div>
            <div className="text-muted-foreground">Pending Sync</div>
          </div>
        </div>

        <Separator />

        {/* Progress Display */}
        {progress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Current Operation</span>
              <Badge variant={progress.errors.length > 0 ? "destructive" : "default"}>
                {progress.errors.length > 0 ? "Errors" : "Running"}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
              {progress.currentOperation}
            </div>

            {progress.totalRepos > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Repository Progress</span>
                  <span>{progress.completedRepos}/{progress.totalRepos}</span>
                </div>
                <Progress value={totalRepoProgress} className="h-2" />
              </div>
            )}

            {progress.totalConversations > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Conversation Progress</span>
                  <span>{progress.completedConversations}/{progress.totalConversations}</span>
                </div>
                <Progress value={totalConvProgress} className="h-2" />
              </div>
            )}

            {progress.errors.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-sm text-destructive mb-2">
                  <AlertCircleIcon className="h-4 w-4" />
                  {progress.errors.length} Error{progress.errors.length !== 1 ? 's' : ''}
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {progress.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-xs text-muted-foreground bg-destructive/10 p-2 rounded">
                      <span className="font-medium">{error.type}:</span> {error.error}
                    </div>
                  ))}
                  {progress.errors.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      ...and {progress.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleInitializeRepos}
                  disabled={isSyncing || totalRepos === 0}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <DownloadIcon className="h-4 w-4 mr-1" />
                  Clone Repos
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Initialize/clone all configured repositories
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSyncPending}
                  disabled={isSyncing || pendingConversations === 0}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Sync Pending
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Sync only conversations that need syncing
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSyncAll}
                  disabled={isSyncing || (totalRepos === 0 && totalConversations === 0)}
                  size="sm"
                  className="w-full"
                >
                  <RefreshCwIcon className={cn(
                    "h-4 w-4 mr-1",
                    isSyncing && "animate-spin"
                  )} />
                  Sync All
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Sync all repositories and conversations
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            onClick={handleAbort}
            disabled={!isSyncing}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            <StopCircleIcon className="h-4 w-4 mr-1" />
            Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 