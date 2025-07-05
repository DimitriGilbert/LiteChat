import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranchIcon, 
  AlertCircleIcon, 
  CheckCircle2Icon, 
  Loader2,
  ClockIcon 
} from "lucide-react";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface SyncStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  className,
  showLabel = true,
  size = "md"
}) => {
  const { t } = useTranslation('git');
  const { 
    syncRepos, 
    conversations, 
    conversationSyncStatus,
    repoInitializationStatus 
  } = useConversationStore(
    useShallow((state) => ({
      syncRepos: state.syncRepos,
      conversations: state.conversations,
      conversationSyncStatus: state.conversationSyncStatus,
      repoInitializationStatus: state.repoInitializationStatus,
    }))
  );

  const syncStatus = useMemo(() => {
    const syncedConversations = conversations.filter(c => c.syncRepoId);
    const pendingConversations = syncedConversations.filter(c => {
      const status = conversationSyncStatus[c.id];
      return status === 'needs-sync';
    });
    const syncingConversations = syncedConversations.filter(c => {
      const status = conversationSyncStatus[c.id];
      return status === 'syncing';
    });
    const errorConversations = syncedConversations.filter(c => {
      const status = conversationSyncStatus[c.id];
      return status === 'error';
    });

    const uninitializedRepos = syncRepos.filter(repo => {
      const status = repoInitializationStatus[repo.id];
      return !status || status === 'error';
    });
    const initializingRepos = syncRepos.filter(repo => {
      const status = repoInitializationStatus[repo.id];
      return status === 'syncing';
    });

    return {
      totalRepos: syncRepos.length,
      totalConversations: syncedConversations.length,
      pendingConversations: pendingConversations.length,
      syncingConversations: syncingConversations.length,
      errorConversations: errorConversations.length,
      uninitializedRepos: uninitializedRepos.length,
      initializingRepos: initializingRepos.length,
    };
  }, [syncRepos, conversations, conversationSyncStatus, repoInitializationStatus]);

  const {  variant, icon, label, tooltipText } = useMemo(() => {
    if (syncStatus.totalRepos === 0) {
      return {
        status: 'none',
        variant: 'secondary' as const,
        icon: <GitBranchIcon className="h-4 w-4" />,
        label: t('syncIndicator.labelNoRepos'),
        tooltipText: t('syncIndicator.tooltipNoRepos')
      };
    }

    if (syncStatus.uninitializedRepos > 0 || syncStatus.initializingRepos > 0) {
      const count = syncStatus.uninitializedRepos + syncStatus.initializingRepos;
      return {
        status: 'initializing',
        variant: 'secondary' as const,
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        label: t('syncIndicator.labelInitializing'),
        tooltipText: t('syncIndicator.tooltipInitializing', { count })
      };
    }

    if (syncStatus.errorConversations > 0) {
      const count = syncStatus.errorConversations;
      return {
        status: 'error',
        variant: 'destructive' as const,
        icon: <AlertCircleIcon className="h-4 w-4" />,
        label: t('syncIndicator.labelSyncErrors'),
        tooltipText: t('syncIndicator.tooltipSyncErrors', { count })
      };
    }

    if (syncStatus.syncingConversations > 0) {
      const count = syncStatus.syncingConversations;
      return {
        status: 'syncing',
        variant: 'default' as const,
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        label: t('syncIndicator.labelSyncing'),
        tooltipText: t('syncIndicator.tooltipSyncing', { count })
      };
    }

    if (syncStatus.pendingConversations > 0) {
      const count = syncStatus.pendingConversations;
      return {
        status: 'pending',
        variant: 'outline' as const,
        icon: <ClockIcon className="h-4 w-4" />,
        label: t('syncIndicator.labelPending', { count }),
        tooltipText: t('syncIndicator.tooltipPending', { count })
      };
    }

    const count = syncStatus.totalConversations;
    return {
      status: 'synced',
      variant: 'default' as const,
      icon: <CheckCircle2Icon className="h-4 w-4 text-green-600" />,
      label: t('syncIndicator.labelAllSynced'),
      tooltipText: t('syncIndicator.tooltipAllSynced', { count })
    };
  }, [syncStatus, t]);

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const clonedIcon = React.cloneElement(icon, { 
    className: cn(iconSize, icon.props.className) 
  });

  const badgeContent = (
    <Badge 
      variant={variant} 
      className={cn(
        "flex items-center gap-1",
        size === 'sm' && "text-xs px-2 py-1",
        size === 'lg' && "text-sm px-3 py-1.5",
        className
      )}
    >
      {clonedIcon}
      {showLabel && <span className="whitespace-nowrap">{label}</span>}
    </Badge>
  );

  if (!tooltipText) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p>{tooltipText}</p>
            {syncStatus.totalRepos > 0 && (
              <div className="text-xs text-muted-foreground">
                <div>{t('syncIndicator.reposConfigured', { count: syncStatus.totalRepos })}</div>
                <div>{t('syncIndicator.convosWithSync', { count: syncStatus.totalConversations })}</div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 