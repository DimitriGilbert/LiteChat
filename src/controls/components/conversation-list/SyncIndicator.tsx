// src/components/LiteChat/chat/control/conversation-list/SyncIndicator.tsx
import React from "react";
import { cn } from "@/lib/utils";
import {
  GitBranchIcon,
  Loader2,
  AlertCircleIcon,
  CheckCircle2Icon,
  AlertTriangleIcon
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SyncStatus } from "@/types/litechat/sync";
import i18next from "i18next";

// Helper to get sync icon and tooltip
export const getSyncIndicator = (
  status: SyncStatus | undefined,
  repoName: string | undefined,
): React.ReactNode => {
  if (!repoName) return null;
  let IconComponent: React.ElementType = GitBranchIcon;
  let className = "text-muted-foreground/70";
  let tooltipText = i18next.t('git:syncIndicatorHelper.linked', { repoName });
  switch (status) {
    case "syncing":
      IconComponent = Loader2;
      className = "animate-spin text-blue-500";
      tooltipText = i18next.t('git:syncIndicatorHelper.syncing', { repoName });
      break;
    case "error":
      IconComponent = AlertCircleIcon;
      className = "text-destructive";
      tooltipText = i18next.t('git:syncIndicatorHelper.error', { repoName });
      break;
    case "needs-sync":
      IconComponent = AlertTriangleIcon
      className = "text-orange-500";
      tooltipText = i18next.t('git:syncIndicatorHelper.needsSync', { repoName });
      break;
    case "idle":
      IconComponent = CheckCircle2Icon;
      className = "text-green-500";
      tooltipText = i18next.t('git:syncIndicatorHelper.synced', { repoName });
      break;
    default:
      // Handle undefined or unexpected status gracefully
      IconComponent = GitBranchIcon;
      className = "text-muted-foreground/70";
      tooltipText = i18next.t('git:syncIndicatorHelper.unknownStatus', { repoName, status: status ?? "Unknown" });
      break;
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconComponent
            className={cn("h-3 w-3 ml-1 flex-shrink-0", className)}
          />
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
