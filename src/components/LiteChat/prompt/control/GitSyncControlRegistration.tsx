// src/components/LiteChat/prompt/control/GitSyncControlRegistration.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { GitBranchIcon, AlertCircleIcon } from "lucide-react"; // Example icons
import { useControlRegistryStore } from "@/store/control.store";
import type { PromptControl } from "@/types/litechat/prompt";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// Placeholder state - replace with actual logic later
const useSyncState = () => {
  // Example: Replace with actual store selector or logic
  const isSyncEnabled = false; // Placeholder
  const needsSync = true; // Placeholder
  const repoName = "my-sync-repo"; // Placeholder
  return { isSyncEnabled, needsSync, repoName };
};

const GitSyncControlComponent: React.FC = () => {
  const { isSyncEnabled, needsSync, repoName } = useSyncState();

  const handleSyncClick = () => {
    // Placeholder action
    toast.info("Manual sync triggered (placeholder).");
    // TODO: Implement actual sync logic
  };

  const handleConfigureClick = () => {
    // Placeholder action
    toast.info("Open sync configuration (placeholder).");
    // TODO: Implement opening relevant settings tab/modal
  };

  if (!isSyncEnabled) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleConfigureClick}
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Configure Git Sync"
            >
              <GitBranchIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Configure Conversation Sync
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSyncClick}
            className="h-10 w-10 rounded-full relative"
            aria-label={`Sync Conversation with ${repoName}`}
          >
            <GitBranchIcon className="h-5 w-5" />
            {needsSync && (
              <AlertCircleIcon className="absolute top-0 right-0 h-3 w-3 text-orange-500 fill-orange-300" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {needsSync
            ? `Sync needed with ${repoName}`
            : `Synced with ${repoName}`}
          <br />
          <span className="text-xs">(Click to sync manually)</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const useGitSyncControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-git-sync-control",
      triggerRenderer: () => <GitSyncControlComponent />,
      show: () => true, // Always show for now, logic can be added
      // getMetadata/getParameters can be added later if needed
      order: 50, // Example order
    };

    const unregister = register(control);
    return unregister;
  }, [register]);

  return null;
};
