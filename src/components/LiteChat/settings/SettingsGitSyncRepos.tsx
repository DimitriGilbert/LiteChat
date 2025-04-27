// src/components/LiteChat/settings/SettingsGitSyncRepos.tsx
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConstructionIcon } from "lucide-react"; // Or another suitable icon

const SettingsGitSyncReposComponent: React.FC = () => {
  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium">Sync Repositories</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure remote Git repositories to synchronize conversations.
          (Coming Soon)
        </p>
        <Alert className="border-blue-500/50 text-blue-700 dark:text-blue-300">
          <ConstructionIcon className="h-4 w-4" />
          <AlertTitle>Under Construction</AlertTitle>
          <AlertDescription>
            Functionality to add, manage, and sync with remote repositories for
            conversation backup and sharing is planned for a future update.
          </AlertDescription>
        </Alert>
      </div>
      {/* Placeholder for future UI: Add Repo button, list of repos */}
    </div>
  );
};

export const SettingsGitSyncRepos = React.memo(SettingsGitSyncReposComponent);
